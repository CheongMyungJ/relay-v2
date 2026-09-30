// 한 번의 실행(시나리오 하나 × 쪽 하나 × 회차 하나). 레포를 만들고, 쪽을 준비하고, 사람 역할을 깨워 가며 끝까지 간다.
// 깨우는 규칙은 두 쪽이 같다: 화면이 바뀌었다가 STABLE_MS 동안 그대로면 깨운다(사람이 화면이 멈춘 것을 알아챔).
// 사람이 기다리기로 했으면 그 시간이 지나도 깨운다. 화면이 계속 바뀌어도 MAX_BUSY_MS마다 한 번은 들여다본다.
import fs from 'node:fs'
import path from 'node:path'
import { CliArm } from './cli-arm.mjs'
import { agentEnv, makeClaudeConfig } from './env.mjs'
import { Human } from './human.mjs'
import { RelayArm } from './relay-arm.mjs'
import { diffTree, judgeTree, makeRepo } from './repo.mjs'
import { agentUsage, appendJsonl, clip, hash, sleep, writeJson } from './util.mjs'

const STABLE_MS = 6000
const MAX_BUSY_MS = 4 * 60 * 1000
const DEFAULT_WAIT_S = 60

const mmss = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}분 ${s % 60}초`
}

/**
 * @param {object} o
 * @param {object} o.scenario scenario.json
 * @param {string} o.scenarioDir
 * @param {'relay'|'cli'} o.kind
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
  const { repo, base } = makeRepo(o.workDir, scenario.repoName ?? 'repo', baseDir)
  const agentConfigDir = makeClaudeConfig(path.join(o.workDir, 'cfg-agent'))
  const humanDir = path.join(o.workDir, 'human')
  const shots = path.join(humanDir, 'shots')
  fs.mkdirSync(shots, { recursive: true })
  const armOpts = { dir: o.workDir, repo, base, agentEnv: agentEnv(opts), agentConfigDir }
  const arm =
    kind === 'relay' ? new RelayArm(armOpts) : new CliArm({ ...armOpts, claudeArgs: opts.cliArgs })
  const human = new Human({
    kind,
    scenario,
    dir: humanDir,
    configDir: makeClaudeConfig(path.join(o.workDir, 'cfg-human')),
    model: opts.humanModel,
    effort: opts.humanEffort,
    vision: kind === 'relay' && opts.vision,
  })
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
    for (const t of trees()) {
      const d = diffTree(t.path, baseDir, path.join(o.workDir, 'inspect', t.label))
      const head = kind === 'relay' ? `# Work ${t.label}${t.removed ? ' (정리됨)' : ''}\n` : ''
      parts.push(`${head}${d.diff.trim() || '(바뀐 것 없음)'}`)
    }
    return clip(parts.join('\n\n') || '(Work가 아직 없음)', 12_000)
  }

  try {
    say(`준비 (${repo})`)
    await arm.prepare()
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
      if (now - t0 > limits.minutes * 60_000) {
        ending = 'timeout'
        break
      }
      if (turns.length >= limits.turns) {
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
        t: Date.now() - t0,
        reason,
        notes: sentNotes,
        thought: decision.thought,
        friction: decision.friction,
        friction_note: decision.friction_note ?? '',
        actions: [],
        costUsd: decision.costUsd,
        ms: decision.ms,
      }
      let waited = false
      for (const a of decision.actions ?? []) {
        counts[a.do] = (counts[a.do] ?? 0) + 1
        const act = { ...a }
        if (a.id !== undefined && screen.elements) {
          const el = screen.elements.find((e) => e.id === a.id)
          act.label = el ? `${el.role} "${el.name}"` : '(없는 요소)'
        }
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
          (a) => `${a.do}${a.label ? ` ${a.label}` : ''}${a.text ? ` "${clip(a.text, 40)}"` : ''}`,
        )
        .join(', ')
      say(`차례 ${n} (${mmss(rec.t)}, ${reason}) friction=${rec.friction} ${brief}`)
      changedSinceTurn = false
      lastTurnAt = Date.now()
      if (ending) break
    }
  } catch (e) {
    ending = 'harness_error'
    error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e)
    say(`도구 오류: ${String(e).slice(0, 300)}`)
  }

  const wallMs = Date.now() - t0
  say(`끝: ${ending} (${mmss(wallMs)})`)
  let survey = null
  if (turns.length > 0) {
    try {
      survey = await human.survey(
        {
          done: '네가 끝났다고 판단함',
          give_up: '네가 포기함',
          timeout: '시간 제한에 걸림',
          turn_limit: '차례 제한에 걸림',
        }[ending] ?? '도구 문제로 멈춤',
      )
    } catch (e) {
      say(`설문 실패: ${String(e).slice(0, 200)}`)
    }
  }

  // 판정
  let final = []
  let works = []
  try {
    arm.snapshot()
    works = arm.works()
    final = trees().map((t) => {
      const j = judgeTree({
        tree: t.path,
        baseDir,
        hiddenDir: path.join(o.scenarioDir, 'hidden'),
        scenario,
        work: path.join(o.workDir, 'judge', t.label),
      })
      fs.mkdirSync(path.join(o.outDir, 'final'), { recursive: true })
      fs.writeFileSync(path.join(o.outDir, 'final', `${t.label}.diff`), j.diff)
      return { label: t.label, removed: !!t.removed, git: t.git ?? null, ...j, diff: undefined }
    })
  } catch (e) {
    say(`판정 실패: ${String(e).slice(0, 300)}`)
    error = `${error ?? ''}\n판정 실패: ${e}`
  }
  await arm.close()

  // 고친 것을 보는 시험은 결과 폴더 하나라도 통과하면 통과다(relay는 버그마다 Work를 따로 만들 수 있다).
  // guard 시험(멀쩡한 동작을 지키는지)은 바뀐 결과 폴더 모두에서 통과해야 한다. 바뀐 폴더가 없으면 모든 폴더를 본다
  const changedTrees = final.filter((f) => f.files.length > 0)
  const guardTrees = changedTrees.length ? changedTrees : final
  const passIn = (f, name) => !!f.checks.find((c) => c.name === name)?.pass
  const checks = (scenario.checks ?? []).map((c) => ({
    name: c.name,
    guard: !!c.guard,
    pass: c.guard
      ? guardTrees.length > 0 && guardTrees.every((f) => passIn(f, c.name))
      : final.some((f) => passIn(f, c.name)),
  }))
  const frictions = turns.map((t) => t.friction).filter((x) => typeof x === 'number')
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
      success: checks.length > 0 && checks.every((c) => c.pass),
      checks,
      repoTestsPass: changedTrees.length > 0 && changedTrees.every((f) => f.repoTests.pass),
      filesChanged: [...new Set(changedTrees.flatMap((f) => f.files.map((x) => x.file)))],
      linesChanged: changedTrees.reduce((a, f) => a + f.linesAdded + f.linesRemoved, 0),
      unrelated: [...new Set(changedTrees.flatMap((f) => f.unrelated))],
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
      frictionMean: frictions.length
        ? frictions.reduce((a, b) => a + b, 0) / frictions.length
        : null,
      frictionHigh: frictions.filter((f) => f >= 2).length,
      costUsd: human.costUsd,
      calls: human.calls,
    },
    setupDialogs,
    agent: agentUsage(agentConfigDir),
    works,
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
    `결과: ${result.outcome.success ? '성공' : '실패'} (${checks.map((c) => `${c.name} ${c.pass ? 'O' : 'X'}`).join(', ')}), 차례 ${turns.length}, 사람 비용 $${human.costUsd.toFixed(2)}`,
  )
  return result
}
