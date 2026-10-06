// 한 번의 실행(시나리오 하나 × 쪽 하나 × 회차 하나). 레포를 만들고, 쪽을 준비하고, 사람 역할을 깨워 가며 끝까지 간다.
// 깨우는 규칙은 두 쪽이 같다: 화면이 바뀌었다가 STABLE_MS 동안 그대로면 깨운다(사람이 화면이 멈춘 것을 알아챔).
// 사람이 기다리기로 했으면 그 시간이 지나도 깨운다. 화면이 계속 바뀌어도 MAX_BUSY_MS마다 한 번은 들여다본다.
import fs from 'node:fs'
import path from 'node:path'
import { CliArm } from './cli-arm.mjs'
import { agentEnv, makeClaudeConfig } from './env.mjs'
import { Human, screenKind } from './human.mjs'
import { armBase } from './kind.mjs'
import { RelayArm } from './relay-arm.mjs'
import { auditTold } from './told.mjs'
import { judgeIssues, isIssue, readDialogue } from './issue-judge.mjs'
import { diffTree, handoffRepo, judgeTree, makeRepo, withoutKnowledge } from './repo.mjs'
import {
  agentUsage,
  agentUsageBySession,
  appendJsonl,
  clip,
  hash,
  questionsBySession,
  sleep,
  writeJson,
} from './util.mjs'
import { allChecks, multiWork, workParts, workScenario } from './works.mjs'

const STABLE_MS = 6000
const MAX_BUSY_MS = 4 * 60 * 1000
const DEFAULT_WAIT_S = 60

/**
 * 숨긴 시험을 결과 폴더들에 모은다. 고친 것을 보는 시험은 결과 폴더 하나라도 통과하면 통과다(relay는 버그마다 Work를
 * 따로 만들 수 있다). guard 시험(멀쩡한 동작을 지키는지)은 바뀐 결과 폴더 모두에서 통과해야 한다. 바뀐 폴더가 없으면
 * 모든 폴더를 본다. 숨긴 쟁점을 판정하지 못한 폴더(pass: null, 판정 모델 오류)가 있으면 통과한 폴더가 없을 때 판정
 * 불가(null)다 (PR #36 리뷰)
 */
export function combineChecks(defs, final) {
  const changedTrees = final.filter((f) => f.files.length > 0)
  const guardTrees = changedTrees.length ? changedTrees : final
  const entry = (f, name) => f.checks.find((c) => c.name === name)
  const passIn = (f, name) => !!entry(f, name)?.pass
  return defs.map((c) => ({
    name: c.name,
    guard: !!c.guard,
    pass: c.guard
      ? guardTrees.length > 0 && guardTrees.every((f) => passIn(f, c.name))
      : final.some((f) => passIn(f, c.name))
        ? true
        : final.some((f) => entry(f, c.name)?.pass === null)
          ? null
          : false,
  }))
}

/**
 * 실행의 성공: 숨긴 시험(과 쟁점)이 모두 통과다. 실패가 하나라도 있으면 false, 실패는 없는데 판정 불가(null)가 있으면
 * null이다(도구 오류라 성공도 실패도 아니다, PR #36 리뷰)
 */
export function outcomeSuccess(checks, complete = true) {
  if (!checks.length || checks.some((c) => c.pass === false)) return false
  if (checks.some((c) => c.pass === null)) return null
  return complete
}

/**
 * 차례 기록에서 사람의 부담을 센다 (Work 하나의 결과). knowledge는 그 Work에서 사람이 아는 것이고, told는 사람 역할이
 * 알려 준 항목 번호(1부터)다. carriedTold는 앞 Work에서 이미 알려 줬던 사실(carry)을 다시 알려 준 항목 수다
 */
function humanOf(turns, knowledge = []) {
  const acts = turns.flatMap((t) => t.actions)
  const told = [
    ...new Set(
      turns.flatMap((t) => (Array.isArray(t.told) ? t.told : [])).filter((i) => knowledge[i - 1]),
    ),
  ].sort((a, b) => a - b)
  const frictions = turns.map((t) => t.friction).filter((x) => typeof x === 'number')
  return {
    turns: turns.length,
    actionsTotal: acts.filter((a) => !['wait', 'done', 'give_up'].includes(a.do)).length,
    charsTyped: acts
      .filter((a) => (a.do === 'type' || a.do === 'fill') && typeof a.text === 'string')
      .reduce((n, a) => n + a.text.length, 0),
    inspectDiff: acts.filter((a) => a.do === 'inspect_diff').length,
    invalidActions: acts.filter((a) => a.ok === false).length,
    refusedDone: acts.filter((a) => a.refused).length,
    frictionMean: frictions.length ? frictions.reduce((a, b) => a + b, 0) / frictions.length : null,
    frictionHigh: frictions.filter((f) => f >= 2).length,
    ms: turns.reduce((a, t) => a + (typeof t.ms === 'number' ? t.ms : 0), 0),
    told,
    carriedTold: told.filter((i) => knowledge[i - 1]?.carry).length,
    carriedTotal: knowledge.filter((k) => k.carry).length,
  }
}

const ENDINGS = {
  done: '네가 끝났다고 판단함',
  give_up: '네가 포기함',
  timeout: '시간 제한에 걸림',
  turn_limit: '차례 제한에 걸림',
}

const mmss = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}분 ${s % 60}초`
}

/**
 * @param {object} o
 * @param {object} o.scenario scenario.json
 * @param {string} o.scenarioDir
 * @param {string} o.kind 쪽: relay, cli, 또는 relay 앱의 다른 빌드(run.mjs의 --app). 이름이 -off로 끝나면 그 빌드에
 *   RELAY_KNOWLEDGE=off를 준다(relay-off는 이 체크아웃의 앱에서 지식 관리를 끈 것)
 *   뒤에 @<유형>이 붙으면(relay@general) 사람 역할이 새 Work에서 그 유형을 고른다(교차 비교, I93)
 * @param {number} o.index 회차 (1부터)
 * @param {object} o.opts 실행 옵션 (run.mjs)
 * @param {string} o.outDir 결과 폴더
 * @param {string} o.workDir 작업 폴더 (/tmp 아래)
 */
export async function runEpisode(o) {
  const { scenario, kind, opts } = o
  const tag = `[${scenario.id} ${kind}#${o.index}]`
  const say = (m) => console.log(`${new Date().toISOString().slice(11, 19)} ${tag} ${m}`)
  // 같은 결과 폴더로 다시 돌리면 같은 회차 번호의 폴더를 다시 쓴다. 앞 실행의 레포, relay 저장소, 결과가 섞이지 않게 비운다
  fs.rmSync(o.workDir, { recursive: true, force: true })
  fs.rmSync(o.outDir, { recursive: true, force: true })
  // 이 회차의 짝 판정도 새 결과로 다시 해야 한다
  fs.rmSync(path.join(path.dirname(o.outDir), `judge-${o.index}.json`), { force: true })
  fs.mkdirSync(o.workDir, { recursive: true })
  fs.mkdirSync(o.outDir, { recursive: true })
  const turnsFile = path.join(o.outDir, 'turns.jsonl')

  const baseDir = path.join(o.scenarioDir, 'repo')
  const repoName = scenario.repoName ?? 'repo'
  const { repo, remote, base } = makeRepo(o.workDir, repoName, baseDir)
  const agentConfigDir = makeClaudeConfig(path.join(o.workDir, 'cfg-agent'))
  /** before 뒤에 새로 생긴 에이전트 세션 (Work마다의 토큰과 질문 수) */
  const newSessions = (before, bySession = agentUsageBySession(agentConfigDir)) =>
    [...bySession.keys()].filter((x) => !before.has(x))
  /** 세션마다의 메시지 수. 이것보다 늘어난 세션이 있으면 에이전트가 일했다 (done 거절, E11) */
  const messageCounts = () =>
    new Map([...agentUsageBySession(agentConfigDir)].map(([k, u]) => [k, u?.messages ?? 0]))
  const agentWorkedSince = (snapshot) =>
    [...messageCounts()].some(([k, n]) => n > (snapshot.get(k) ?? 0))
  const humanDir = path.join(o.workDir, 'human')
  const shots = path.join(humanDir, 'shots')
  fs.mkdirSync(shots, { recursive: true })
  const armOpts = { dir: o.workDir, repo, base, agentEnv: agentEnv(opts), agentConfigDir }
  const screenType = screenKind(kind)
  // 쪽의 앱 빌드: @<유형>(I93)과 -off를 뗀 이름이 --app에 있으면 그 폴더, 없으면 이 체크아웃의 앱
  const build = armBase(kind).replace(/-off$/, '')
  const arm =
    screenType === 'relay'
      ? new RelayArm({
          ...armOpts,
          appDir: opts.apps?.[build],
          knowledge: !armBase(kind).endsWith('-off'),
        })
      : new CliArm({ ...armOpts, claudeArgs: opts.cliArgs })
  const handoffs = []
  // Work 둘을 잇는 시나리오는 Work마다 사람 역할 세션을 새로 둔다. 같은 사람이지만 그 Work의 사정만 받는다
  const multi = multiWork(scenario)
  const parts = workParts(scenario)
  const humans = []
  const makeHuman = (n) => {
    const h = new Human({
      kind: screenType,
      arm: kind,
      scenario: multi ? workScenario(scenario, n) : scenario,
      dir: humanDir,
      configDir: makeClaudeConfig(path.join(o.workDir, multi ? `cfg-human-${n + 1}` : 'cfg-human')),
      model: opts.humanModel,
      effort: opts.humanEffort,
      vision: screenType === 'relay' && opts.vision,
    })
    humans.push(h)
    return h
  }
  const limits = {
    minutes: opts.maxMinutes ?? scenario.limits?.minutes ?? 40,
    turns: opts.maxTurns ?? scenario.limits?.turns ?? 60,
  }

  const t0 = Date.now()
  const turns = []
  const setupDialogs = []
  const counts = {}
  let charsTyped = 0
  let invalid = 0
  let refusedDone = 0
  let ending = null
  let summary = ''
  let error = null
  let firstChangeAt = null
  const events = (scenario.events ?? []).map((e) => ({ ...e, fired: false }))
  const reveals = (scenario.reveals ?? []).map((e) => ({ ...e, fired: false }))

  const trees = () => arm.finalTrees()
  const changed = () =>
    trees().some(
      (t) =>
        !t.removed && t.git && !t.git.error && (t.git.commits > 0 || t.git.uncommitted.length > 0),
    )
  const due = (e, now) => {
    const after = (e.afterSeconds ?? 0) * 1000
    if (e.when === 'first_change') return firstChangeAt !== null && now >= firstChangeAt + after
    if (e.when === 'elapsed') return now >= t0 + after
    return false
  }
  const currentDiff = () => {
    const parts = []
    const all = trees()
    for (const t of all) {
      const d = diffTree(t.path, baseDir, path.join(o.workDir, 'inspect', t.label))
      // 맨 CLI는 체크아웃되지 않은 브랜치에 고친 것이 있을 때만 브랜치를 밝힌다
      const head =
        screenType === 'relay'
          ? `# Work ${t.label}${t.removed ? ' (정리됨)' : ''}\n`
          : all.length > 1
            ? `# ${t.label === 'repo' ? '체크아웃된 ' : ''}브랜치 ${t.git?.branch ?? '?'}\n`
            : ''
      parts.push(`${head}${d.diff.trim() || '(바뀐 것 없음)'}`)
    }
    return clip(parts.join('\n\n') || '(Work가 아직 없음)', 12_000)
  }

  const workResults = []
  // 지금 Work: 시작한 차례, 때, 그때 있던 에이전트 세션·결과 폴더·relay Work
  let part = null
  /** Work 하나를 마친다: 그 Work의 사람 역할 설문과, Work 둘을 잇는 시나리오면 그 Work의 판정과 에이전트 */
  const finishPart = async (partEnding, partSummary) => {
    const p = part
    part = null
    if (!p) return
    const own = turns.slice(p.turn)
    let partSurvey = null
    if (own.length > 0) {
      try {
        partSurvey = await p.human.survey(ENDINGS[partEnding] ?? '도구 문제로 멈춤')
      } catch (e) {
        say(`설문 실패: ${String(e).slice(0, 200)}`)
      }
    }
    const r = {
      work: p.n + 1,
      ending: partEnding,
      summary: partSummary,
      wallMs: Date.now() - p.t,
      survey: partSurvey,
      human: humanOf(own, parts[p.n]?.knowledge ?? []),
      ...(p.handoff ? { handoff: p.handoff } : {}),
    }
    if (multi) {
      // 다시 알려 줌의 감사: 판정 모델이 이 Work에서 사람이 입력한 말을 읽고 가른다(PM1)
      const known = parts[p.n]?.knowledge ?? []
      try {
        const a = await auditTold({
          knowledge: known,
          turns: own,
          model: opts.judgeModel ?? 'sonnet',
          workDir: path.join(o.workDir, 'told', `work-${p.n + 1}`),
        })
        if (a) {
          r.human.toldAudit = a.told
          r.human.carriedToldAudit = a.told.filter((i) => known[i - 1]?.carry).length
          r.human.auditCostUsd = a.costUsd
        }
      } catch (e) {
        say(`Work ${p.n + 1} 다시 알려 줌 감사 실패: ${String(e).slice(0, 200)}`)
      }
      try {
        arm.snapshot()
        const ws = workScenario(scenario, p.n)
        const all = trees()
        // relay는 이 Work에서 생긴 결과 폴더(worktree)만, 맨 CLI는 레포와 브랜치 모두를 본다
        const fresh = screenType === 'relay' ? all.filter((t) => !p.trees.has(t.label)) : all
        const judged = (fresh.length ? fresh : all).map((t) => ({
          label: t.label,
          ...judgeTree({
            tree: t.path,
            baseDir,
            hiddenDir: path.join(o.scenarioDir, 'hidden'),
            scenario: ws,
            work: path.join(o.workDir, 'judge', `work-${p.n + 1}`, t.label),
          }),
        }))
        const checks = combineChecks(ws.checks, judged)
        r.outcome = {
          success: outcomeSuccess(checks),
          checks,
          trees: judged.map((j) => ({
            label: j.label,
            files: j.files.map((f) => f.file),
            repoTestsPass: j.repoTests.pass,
          })),
        }
      } catch (e) {
        say(`Work ${p.n + 1} 판정 실패: ${String(e).slice(0, 300)}`)
      }
      // 이 Work에서 새로 생긴 에이전트 세션의 토큰과 질문 수
      const bySession = agentUsageBySession(agentConfigDir)
      const asked = questionsBySession(agentConfigDir)
      const sessions = newSessions(p.sessions, bySession)
      const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0 }
      for (const x of sessions) {
        const u = bySession.get(x)
        for (const k of Object.keys(tokens)) tokens[k] += u?.[k] ?? 0
      }
      r.agent = {
        ...tokens,
        sessions: sessions.length,
        questions: sessions.reduce((a, x) => a + (asked.get(x) ?? 0), 0),
      }
      // relay는 이 Work에서 생긴 Work의 context.md 글자와 `참고 지식` 글자 (지식을 끄면 null)
      const tasks = arm
        .works()
        .filter((w) => !p.works.has(w.id))
        .flatMap((w) => w.tasks)
      r.contextChars = tasks.length ? tasks.reduce((a, t) => a + (t.contextChars ?? 0), 0) : null
      r.knowledgeChars = tasks.some((t) => typeof t.knowledgeChars === 'number')
        ? tasks.reduce((a, t) => a + (t.knowledgeChars ?? 0), 0)
        : null
      say(
        `Work ${r.work} 끝: ${partEnding} (${(r.outcome?.checks ?? []).map((c) => `${c.name} ${c.pass ? 'O' : 'X'}`).join(', ')}), 차례 ${r.human.turns}, 질문 ${r.agent.questions}`,
      )
    }
    workResults.push(r)
  }

  try {
    say(`준비 (${repo})`)
    // 에이전트 세션은 쪽이 claude를 띄우기 전(준비, 다음 Work로 넘김)에 센다. 맨 CLI는 띄울 때 세션이 생길 수 있다
    let sessionsBefore = new Set(agentUsageBySession(agentConfigDir).keys())
    await arm.prepare()
    for (let w = 0; w < parts.length; w++) {
      let handoff = null
      if (w > 0) {
        sessionsBefore = new Set(agentUsageBySession(agentConfigDir).keys())
        arm.snapshot()
        let moved
        if (parts[w].teammate) {
          // 팀원 교대: 앞 사람의 브랜치를 main에 머지하고 새 clone, 새 앱 저장소(relay)나 새 터미널(맨 CLI)에서 시작한다
          const h = handoffRepo(
            arm.o.repo,
            remote,
            path.join(o.workDir, `${repoName}-mate${handoffs.length + 1}`),
          )
          handoff = { work: w + 1, merged: h.merged, conflicts: h.conflicts, failed: h.failed }
          handoffs.push(handoff)
          say(
            `팀원 교대: 머지 ${h.merged.length}개${h.conflicts.length ? `, 충돌 ${h.conflicts.length}개(뒤 쪽으로 머지)` : ''}${h.failed.length ? `, 머지 못함 ${h.failed.length}개` : ''}`,
          )
          moved = await arm.handoff(h.repo)
        } else {
          moved = await arm.nextWork()
        }
        if (moved) say(moved)
      }
      const human = makeHuman(w)
      part = {
        n: w,
        human,
        turn: turns.length,
        t: Date.now(),
        sessions: sessionsBefore,
        // done 거절(E11)은 다음 Work로 넘긴 뒤 메시지가 늘어난 세션으로 본다. 맨 CLI는 새로 띄울 때 세션이 생기고 그
        // 세션에서 일할 수 있어, 새 세션이 있는지로는 가르지 못한다
        started: messageCounts(),
        trees: new Set(trees().map((t) => t.label)),
        works: new Set(arm.works().map((x) => x.id)),
        handoff,
      }
      ending = null
      summary = ''
      if (multi) {
        say(`Work ${w + 1}/${parts.length} 시작`)
        appendJsonl(turnsFile, { event: 'work', t: Date.now() - t0, text: `Work ${w + 1}` })
      }
      const partT0 = Date.now()
      let lastSig = null
      let lastChange = Date.now()
      let changedSinceTurn = true
      let lastTurnAt = Date.now()
      let waitUntil = Date.now()
      let immediate = false
      let force = false
      let notes = []
      let results = []
      let diff
      let lastCheck = 0
      let failures = 0
      let readErrors = 0

      for (;;) {
        const now = Date.now()
        if (now - partT0 > limits.minutes * 60_000) {
          ending = 'timeout'
          break
        }
        if (turns.length - part.turn >= limits.turns) {
          ending = 'turn_limit'
          break
        }
        let sig
        try {
          const polled = await arm.poll()
          const dialog = await arm.handleSetupDialogs(polled)
          if (dialog) {
            setupDialogs.push({ t: now - t0, name: dialog })
            say(`첫 실행 창 수락: ${dialog}`)
          }
          for (const n of await arm.notifications()) {
            notes.push(`OS 알림 — ${n}`)
            force = true
          }
          sig = hash(polled.signature)
          readErrors = 0
        } catch (e) {
          // 창을 다시 띄우는 중 같은 잠깐의 오류는 넘긴다. 30초 넘게 이어지면 멈춘다
          if (++readErrors > 30) throw e
          await sleep(1000)
          continue
        }
        if (sig !== lastSig) {
          lastSig = sig
          lastChange = now
          changedSinceTurn = true
        }
        if (now - lastCheck > 3000) {
          lastCheck = now
          if (firstChangeAt === null && changed()) {
            firstChangeAt = now
            say(`첫 코드 변경 (${mmss(now - t0)})`)
          }
          for (const e of events) {
            if (e.fired || !due(e, now)) continue
            e.fired = true
            if (e.do === 'crash') {
              say('사건: 비정상 종료')
              arm.snapshot()
              notes.push(await arm.crash())
              appendJsonl(turnsFile, { event: 'crash', t: Date.now() - t0 })
              force = true
              lastChange = Date.now()
            }
          }
          for (const r of reveals) {
            if (r.fired || !due(r, now)) continue
            r.fired = true
            say('사건: 새 요구가 떠오름')
            notes.push(`방금 새로 떠오른 것: ${r.text}`)
            appendJsonl(turnsFile, { event: 'reveal', t: now - t0, text: r.text })
            force = true
          }
        }

        const stableFor = now - lastChange
        let reason = null
        if (immediate) reason = '직전 행동의 결과'
        else if (force && stableFor >= 2000) reason = '알림'
        else if (changedSinceTurn && stableFor >= STABLE_MS && now - lastTurnAt >= 2000)
          reason = '화면이 멈춤'
        else if (now >= waitUntil && stableFor >= STABLE_MS) reason = '기다림이 끝남'
        else if (now - lastTurnAt >= MAX_BUSY_MS) reason = '오래 걸려 들여다봄'
        if (!reason) {
          await sleep(1000)
          continue
        }

        // 사람의 차례
        arm.snapshot()
        const n = turns.length + 1
        const shot = path.join(shots, `${String(n).padStart(3, '0')}.png`)
        let screen
        try {
          screen = await arm.observe(shot)
        } catch (e) {
          if (++readErrors > 30) throw e
          await sleep(1000)
          continue
        }
        const obs = { turn: n, elapsed: mmss(Date.now() - t0), notes, results, diff, screen }
        const sent = { notes, results, diff, immediate, force }
        const sentNotes = notes
        notes = []
        results = []
        diff = undefined
        immediate = false
        force = false
        let decision
        try {
          decision = await human.turn(obs)
          failures = 0
        } catch (e) {
          failures++
          say(`사람 역할 호출 실패 (${failures}): ${String(e).slice(0, 200)}`)
          // 다음 차례에 같은 알림, 행동 결과, 코드 차이를 다시 보인다
          ;({ notes, results, diff, immediate, force } = sent)
          if (failures >= 3) {
            ending = 'human_error'
            error = String(e)
            break
          }
          await sleep(5000)
          continue
        }
        const rec = {
          turn: n,
          ...(multi ? { work: w + 1 } : {}),
          t: Date.now() - t0,
          reason,
          notes: sentNotes,
          thought: decision.thought,
          friction: decision.friction,
          told: Array.isArray(decision.told) ? decision.told : [],
          friction_note: decision.friction_note ?? '',
          actions: [],
          costUsd: decision.costUsd,
          ms: decision.ms,
        }
        let waited = false
        for (const a of decision.actions ?? []) {
          const act = { ...a }
          if (a.id !== undefined && screen.elements) {
            const el = screen.elements.find((e) => e.id === a.id)
            act.label = el ? `${el.role} "${el.name}"` : '(없는 요소)'
          }
          // 두 번째 Work부터는 이번 일에서 에이전트가 일한 기록(메시지)이 없으면 done을 받지 않는다. 사람 역할이 앞 Work의
          // 완료 화면을 이번 일로 읽고 [새 Work] 없이 끝낸 일이 있었다(2026-10-02 평가 21~23, E11). 행동 수에는
          // 세지 않고 refusedDone으로 센다
          if (a.do === 'done' && w > 0 && !agentWorkedSince(part.started)) {
            refusedDone++
            act.refused = true
            act.result =
              '받지 않음: 이번 일은 아직 시작하지 않았다. 이번 일에서 에이전트가 일한 기록이 없다. 화면에 남은 것은 앞 일이고, 앞 일의 변경은 기준 브랜치에 들어가지 않았다'
            results.push(act.result)
            rec.actions.push(act)
            immediate = true
            break
          }
          counts[a.do] = (counts[a.do] ?? 0) + 1
          if (a.do === 'done' || a.do === 'give_up') {
            ending = a.do
            summary = a.summary ?? a.reason ?? ''
            rec.actions.push(act)
            break
          }
          if (a.do === 'wait') {
            waited = true
            const s = Math.min(Math.max(a.seconds ?? DEFAULT_WAIT_S, 5), 900)
            waitUntil = Date.now() + s * 1000
            act.result = `${s}초 기다림`
          } else if (a.do === 'inspect_diff') {
            diff = currentDiff()
            immediate = true
            act.result = '바뀐 코드를 봄'
          } else {
            if (typeof a.text === 'string' && (a.do === 'type' || a.do === 'fill'))
              charsTyped += a.text.length
            let r
            try {
              r = await arm.act(a)
            } catch (e) {
              r = { ok: false, message: `실패: ${String(e).split('\n')[0].slice(0, 200)}` }
            }
            act.result = r.message
            act.ok = r.ok
            if (!r.ok) invalid++
            results.push(r.message)
            await sleep(700)
          }
          rec.actions.push(act)
        }
        if (!waited) waitUntil = Date.now() + DEFAULT_WAIT_S * 1000
        turns.push(rec)
        appendJsonl(turnsFile, rec)
        const brief = rec.actions
          .map(
            (a) =>
              `${a.do}${a.label ? ` ${a.label}` : ''}${a.text ? ` "${clip(a.text, 40)}"` : ''}`,
          )
          .join(', ')
        say(`차례 ${n} (${mmss(rec.t)}, ${reason}) friction=${rec.friction} ${brief}`)
        changedSinceTurn = false
        lastTurnAt = Date.now()
        if (ending) break
      }
      await finishPart(ending, summary)
      // 사람 역할이 응답하지 못하면 다음 Work로 가지 않는다. 시간·차례 제한이나 포기는 다음 Work를 그대로 돌린다
      if (ending === 'human_error') break
    }
  } catch (e) {
    ending = 'harness_error'
    error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e)
    say(`도구 오류: ${String(e).slice(0, 300)}`)
    try {
      await finishPart(ending, summary)
    } catch (e2) {
      say(`Work 마무리 실패: ${String(e2).slice(0, 200)}`)
    }
  }

  const wallMs = Date.now() - t0
  say(`끝: ${ending} (${mmss(wallMs)})`)
  // 설문은 Work마다 했다. 짝 판정과 보고서는 마지막 Work의 설문을 본다(Work 둘이면 재는 Work 2)
  const survey = workResults.findLast((r) => r.survey)?.survey ?? null

  // 판정
  let final = []
  let works = []
  /** 결과 폴더마다의 diff. 숨긴 쟁점의 판정 모델에 준다 */
  const diffs = new Map()
  let issueJudge = null
  try {
    arm.snapshot()
    works = arm.works()
    final = trees().map((t) => {
      const j = judgeTree({
        tree: t.path,
        baseDir,
        hiddenDir: path.join(o.scenarioDir, 'hidden'),
        scenario: { ...scenario, checks: allChecks(scenario) },
        work: path.join(o.workDir, 'judge', t.label),
      })
      fs.mkdirSync(path.join(o.outDir, 'final'), { recursive: true })
      fs.writeFileSync(path.join(o.outDir, 'final', `${t.label}.diff`), j.diff)
      diffs.set(t.label, j.diff)
      return { label: t.label, removed: !!t.removed, git: t.git ?? null, ...j, diff: undefined }
    })
  } catch (e) {
    say(`판정 실패: ${String(e).slice(0, 300)}`)
    error = `${error ?? ''}\n판정 실패: ${e}`
  }
  await arm.close()

  // 숨긴 쟁점 (relay I111): 바뀐 결과 폴더마다 판정 모델이 문서와 대화 기록으로 가른다. Work 하나짜리만이다
  const issues = allChecks(scenario).filter(isIssue)
  if (issues.length && !multi) {
    try {
      const dialogue = readDialogue(agentConfigDir)
      issueJudge = { costUsd: 0, trees: [] }
      for (const f of final.filter((x) => x.files.length > 0)) {
        const r = await judgeIssues({
          issues,
          diff: withoutKnowledge(diffs.get(f.label) ?? ''),
          dialogue,
          model: opts.judgeModel ?? 'sonnet',
          workDir: path.join(o.workDir, 'issues', f.label),
        })
        issueJudge.costUsd += r.costUsd
        issueJudge.trees.push({ label: f.label, checks: r.checks })
        f.checks = f.checks.map((c) => r.checks.find((x) => x.name === c.name) ?? c)
      }
      say(`숨긴 쟁점 판정: ${issueJudge.trees.length}개 폴더, $${issueJudge.costUsd.toFixed(2)}`)
    } catch (e) {
      say(`숨긴 쟁점 판정 실패: ${String(e).slice(0, 300)}`)
      error = `${error ?? ''}\n숨긴 쟁점 판정 실패: ${e}`
      // 판정하지 못한 쟁점은 실패가 아니라 판정 불가다. 성공과 통과율에서 빼고 보고서에 따로 센다 (PR #36 리뷰)
      for (const f of final)
        if (f.files.length > 0)
          f.checks = f.checks.map((c) =>
            c.issue && c.pending ? { ...c, pass: null, output: '판정 모델 오류' } : c,
          )
    }
  }

  const changedTrees = final.filter((f) => f.files.length > 0)
  // Work 둘을 잇는 시나리오는 Work마다 판정한 것을 모은다. 나머지는 마지막 결과 폴더들로 판정한다
  const checks = multi
    ? workResults.flatMap((r) => r.outcome?.checks ?? [])
    : combineChecks(allChecks(scenario), final)
  const frictions = turns.map((t) => t.friction).filter((x) => typeof x === 'number')
  const humanCost = humans.reduce((a, h) => a + h.costUsd, 0)
  // relay의 단계별 에이전트 토큰과 context.md 크기 (eval-findings R9). 세션 id로 대화 기록을 맞춘다
  const bySession = agentUsageBySession(agentConfigDir)
  const agentSteps = works.flatMap((w) =>
    w.tasks.map((t) => ({
      work: w.id,
      seq: t.seq,
      node: t.node,
      contextChars: t.contextChars ?? null,
      knowledgeChars: t.knowledgeChars ?? null,
      tokens: t.session ? (bySession.get(t.session) ?? null) : null,
    })),
  )
  const result = {
    scenario: scenario.id,
    kind,
    index: o.index,
    ending,
    summary,
    error,
    wallMs,
    firstChangeMs: firstChangeAt ? firstChangeAt - t0 : null,
    outcome: {
      // Work 둘을 잇는 시나리오는 모든 Work를 돌려 판정했을 때만 성공이다. 앞 Work에서 멈추면 재는 Work의 시험이 없다
      success: outcomeSuccess(
        checks,
        !multi || (workResults.length === parts.length && workResults.every((r) => !!r.outcome)),
      ),
      checks,
      repoTestsPass: changedTrees.length > 0 && changedTrees.every((f) => f.repoTests.pass),
      filesChanged: [...new Set(changedTrees.flatMap((f) => f.files.map((x) => x.file)))],
      linesChanged: changedTrees.reduce((a, f) => a + f.linesAdded + f.linesRemoved, 0),
      unrelated: [...new Set(changedTrees.flatMap((f) => f.unrelated))],
      // relay의 지식 파일: 위 코드 결과에서 빼고 따로 센다 (lib/repo.mjs KNOWLEDGE_FILE)
      knowledgeFiles: [...new Set(final.flatMap((f) => f.knowledgeFiles ?? []))],
      // 숨긴 쟁점의 판정(결과 폴더마다 asked, reflected, 근거)과 비용 (relay I111)
      ...(issueJudge ? { issueJudge } : {}),
      committed:
        changedTrees.length > 0 &&
        changedTrees.every(
          (f) => f.git && !f.git.error && f.git.commits > 0 && f.git.uncommitted.length === 0,
        ),
      trees: final,
    },
    human: {
      turns: turns.length,
      actions: counts,
      actionsTotal: Object.entries(counts)
        .filter(([k]) => !['wait', 'done', 'give_up'].includes(k))
        .reduce((a, [, v]) => a + v, 0),
      charsTyped,
      invalidActions: invalid,
      refusedDone,
      frictionMean: frictions.length
        ? frictions.reduce((a, b) => a + b, 0) / frictions.length
        : null,
      frictionHigh: frictions.filter((f) => f >= 2).length,
      costUsd: humanCost,
      calls: humans.reduce((a, h) => a + h.calls, 0),
      // 사람 역할이 답하는 데 쓴 시간의 합과 기다리기만 한 차례 (eval-findings E2)
      ms: turns.reduce((a, t) => a + (typeof t.ms === 'number' ? t.ms : 0), 0),
      waitOnlyTurns: turns.filter((t) => t.actions.every((a) => a.do === 'wait')).length,
      // 스크린샷을 붙인 차례 (eval-findings E10)
      images: humans.reduce((a, h) => a + h.images, 0),
    },
    setupDialogs,
    agent: agentUsage(agentConfigDir),
    agentSteps,
    works,
    ...(multi ? { workResults, handoffs } : {}),
    survey,
    options: {
      agentModel: opts.agentModel,
      effort: opts.effort,
      humanModel: opts.humanModel,
      cliArgs: opts.cliArgs,
    },
  }
  writeJson(path.join(o.outDir, 'run.json'), result)
  // 스크린샷은 결과 폴더로 옮긴다
  if (fs.existsSync(shots) && fs.readdirSync(shots).length)
    fs.cpSync(shots, path.join(o.outDir, 'shots'), { recursive: true })
  // relay의 Work 기록(산출물, handoff, pty.log)도 남긴다
  for (const w of works) fs.cpSync(w.dir, path.join(o.outDir, 'works', w.id), { recursive: true })
  say(
    `결과: ${result.outcome.success ? '성공' : '실패'} (${checks.map((c) => `${c.name} ${c.pass ? 'O' : 'X'}`).join(', ')}), 차례 ${turns.length}, 사람 비용 $${humanCost.toFixed(2)}`,
  )
  return result
}
