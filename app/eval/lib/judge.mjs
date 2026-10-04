// 판정. 같은 시나리오의 같은 회차에서 두 쪽(relay와 맨 CLI, Work 둘을 잇는 시나리오면 relay와 relay-off)의 결과를
// 짝지어 비교한다. A와 B의 순서는 무작위다.
// - 결과 판정(가림): 코드 차이와 시험 결과만 보고, 어느 도구로 만들었는지 모른 채 비교한다.
// - 경험 판정: 사람 역할의 차례 기록과 설문을 보고 비교한다. 화면 기록에 도구가 드러나므로 가릴 수 없다.
import fs from 'node:fs'
import path from 'node:path'
import { ask } from './ai.mjs'
import { makeClaudeConfig } from './env.mjs'
import { codeOutcome, withoutKnowledge } from './repo.mjs'
import { clip, readJsonl } from './util.mjs'
import { words } from './kind.mjs'
import { multiWork, workParts } from './works.mjs'

const score = { type: 'integer', minimum: 1, maximum: 5 }
const OUTCOME_SCHEMA = {
  type: 'object',
  properties: {
    A: {
      type: 'object',
      properties: { correctness: score, scope: score, quality: score, tests: score },
      required: ['correctness', 'scope', 'quality', 'tests'],
    },
    B: {
      type: 'object',
      properties: { correctness: score, scope: score, quality: score, tests: score },
      required: ['correctness', 'scope', 'quality', 'tests'],
    },
    preferred: { type: 'string', enum: ['A', 'B', 'tie'] },
    reason: { type: 'string' },
  },
  required: ['A', 'B', 'preferred', 'reason'],
}

const DIMENSIONS = ['burden', 'clarity', 'control', 'recovery', 'confidence', 'overall']
const winner = {
  type: 'object',
  properties: {
    winner: { type: 'string', enum: ['A', 'B', 'tie', 'n/a'] },
    note: { type: 'string' },
  },
  required: ['winner', 'note'],
}
const EXPERIENCE_SCHEMA = {
  type: 'object',
  properties: {
    ...Object.fromEntries(DIMENSIONS.map((d) => [d, winner])),
    A_score: { type: 'integer', minimum: 1, maximum: 10 },
    B_score: { type: 'integer', minimum: 1, maximum: 10 },
    reason: { type: 'string' },
  },
  required: [...DIMENSIONS, 'A_score', 'B_score', 'reason'],
}

function scenarioBrief(s) {
  const text = (r) => (Array.isArray(r) ? r.join(' ') : r)
  // Work 둘을 잇는 시나리오는 Work마다 리포트, 아는 사실, 숨긴 시험을 보인다
  const parts = multiWork(s)
    ? workParts(s).flatMap((w, n) => [
        `Work ${n + 1}의 ${words(s).report}: ${text(w.report)}`,
        ...(w.knowledge ?? []).map((k) => `Work ${n + 1}에서 사람이 아는 사실: ${k.text}`),
        `Work ${n + 1}의 숨긴 시험: ${(w.checks ?? []).map((c) => c.name).join(', ')}`,
      ])
    : [
        `${words(s).report}: ${text(s.report)}`,
        ...(s.knowledge ?? []).map((k) => `사람이 아는 사실: ${k.text}`),
      ]
  return [
    `시나리오: ${s.id} — ${s.title}`,
    `평가 목적: ${s.purpose}`,
    ...parts,
    ...(s.preferences ?? []).map((p) => `사람의 선호: ${p}`),
    ...(s.reveals ?? []).map((r) => `도중에 더해진 요구: ${r.text}`),
    ...(s.events ?? []).map((e) => `도중의 사건: ${e.do} (${e.when})`),
    ...(multiWork(s)
      ? []
      : [`숨긴 시험(요구사항): ${(s.checks ?? []).map((c) => c.name).join(', ')}`]),
    `수정이 기대되는 파일: ${(s.expectedFiles ?? []).join(', ')}`,
  ].join('\n')
}

function outcomeBlock(run, runDir) {
  const o = run.outcome
  // relay의 지식 파일은 코드 결과가 아니라 판정에서 뺀다. 맨 CLI에는 없어 두면 가림도 깨진다 (lib/repo.mjs)
  const code = codeOutcome(o)
  const diffs = fs.existsSync(path.join(runDir, 'final'))
    ? fs
        .readdirSync(path.join(runDir, 'final'))
        .map((f) => withoutKnowledge(fs.readFileSync(path.join(runDir, 'final', f), 'utf8')))
        .join('\n')
    : ''
  return [
    `숨긴 시험: ${o.checks.map((c) => `${c.name} ${c.pass ? '통과' : '실패'}`).join(', ') || '없음'}`,
    `레포 시험: ${o.repoTestsPass ? '통과' : '실패 또는 변경 없음'}`,
    `바뀐 파일: ${code.filesChanged.join(', ') || '없음'} (${code.linesChanged}줄)`,
    `기대 밖 파일: ${code.unrelated.join(', ') || '없음'}`,
    '코드 차이:',
    '```diff',
    // 커밋 메시지와 도구 흔적 없이 코드만 보인다
    clip(diffs || '(변경 없음)', 9000),
    '```',
  ].join('\n')
}

function timeline(run, runDir) {
  const lines = []
  for (const t of readJsonl(path.join(runDir, 'turns.jsonl'))) {
    if (t.event) {
      lines.push(`- [사건] ${t.event}${t.text ? `: ${t.text}` : ''}`)
      continue
    }
    const acts = t.actions
      .map((a) => {
        const what = a.label ?? (a.text ? `"${clip(a.text, 120)}"` : (a.key ?? a.seconds ?? ''))
        return `${a.do} ${what}${a.result ? ` → ${a.result}` : ''}`.trim()
      })
      .join('; ')
    const min = (t.t / 60000).toFixed(1)
    lines.push(
      `- ${min}분 #${t.turn} (${t.reason}) friction ${t.friction}${t.friction_note ? ` "${t.friction_note}"` : ''} | ${clip(t.thought, 200)} | ${acts}`,
    )
  }
  const h = run.human
  const s = run.survey
  return [
    `끝: ${run.ending} (${(run.wallMs / 60000).toFixed(1)}분) ${run.summary ?? ''}`,
    `사람: 차례 ${h.turns}, 행동 ${h.actionsTotal}, 입력 ${h.charsTyped}자, friction 평균 ${h.frictionMean?.toFixed(2) ?? '-'}, 2 이상 ${h.frictionHigh}번`,
    s
      ? `설문: 수고 ${s.effort}, 명확 ${s.clarity}, 통제 ${s.control}, 확신 ${s.confidence}, 신뢰 ${s.trust}, 복구 ${s.recovery ?? '-'}, 재사용 ${s.reuse} / 좋음: ${s.best} / 불편: ${s.worst}`
      : '설문: 없음',
    '차례 기록:',
    clip(lines.join('\n'), 14_000),
  ].join('\n')
}

/**
 * 한 짝을 판정한다. first와 second는 두 쪽의 run.json이고 kind가 이름이 된다(relay, cli, relay-off)
 * @returns {Promise<object>} 쪽 이름으로 되돌린 결과. pair가 [first, second]의 이름이다
 */
export async function judgePair({ scenario, first, second, firstDir, secondDir, opts, workDir }) {
  const pair = [first.kind, second.kind]
  const flip = Math.random() < 0.5
  const [A, B] = flip ? [second, first] : [first, second]
  const [Ad, Bd] = flip ? [secondDir, firstDir] : [firstDir, secondDir]
  const nameOf = (x) =>
    x === 'A' ? (flip ? pair[1] : pair[0]) : x === 'B' ? (flip ? pair[0] : pair[1]) : x
  const configDir = makeClaudeConfig(path.join(workDir, 'cfg-judge'))
  fs.mkdirSync(workDir, { recursive: true })
  const common = { model: opts.judgeModel, cwd: workDir, configDir, tools: [], timeoutMs: 300_000 }
  const system =
    '너는 소프트웨어 사용성 평가의 공정한 심사자다. 주어진 기록만 근거로 판단하고, 도구 이름이나 기능이 많고 적음에 끌리지 않는다. 한국어로 답한다.'

  const outcome = await ask({
    ...common,
    system,
    schema: OUTCOME_SCHEMA,
    prompt: [
      `${words(scenario).same} 두 번 따로 ${words(scenario).did} 결과 A와 B를 비교하라. 어떻게 만들었는지는 알려 주지 않는다.`,
      `각각을 1~5로 매겨라: correctness(요구대로 ${words(scenario).made}. 숨긴 시험을 참고하되 코드도 보라), scope(필요한 만큼만 바꿨나), quality(읽기 쉽고 올바른 코드인가), tests(회귀를 막는 시험을 더했나).`,
      '',
      scenarioBrief(scenario),
      '',
      '## 결과 A',
      outcomeBlock(A, Ad),
      '',
      '## 결과 B',
      outcomeBlock(B, Bd),
    ].join('\n'),
  })

  const experience = await ask({
    ...common,
    system,
    schema: EXPERIENCE_SCHEMA,
    prompt: [
      multiWork(scenario)
        ? `같은 레포에서 일 ${workParts(scenario).length}개(Work)를 차례로 한 두 사용 기록 A와 B를 비교하라. 사람 역할은 AI가 연기했다. 두 기록은 같은 앱의 다른 버전이거나 설정만 다르다. 앞 일에서 알게 된 것이 뒤 일에서 얼마나 이어졌는지(같은 질문과 같은 실수를 되풀이했는지)를 특히 본다.`
        : `${words(scenario).same} 서로 다른 도구로 ${words(scenario).did} 두 사용 기록 A와 B를 비교하라. 사람 역할은 AI가 연기했다.`,
      '차원마다 어느 쪽이 나았는지(A, B, tie, 해당 없으면 n/a)와 근거를 짧게 적어라.',
      '- burden: 사람이 들인 수고(차례, 행동, 입력, 기다림, 헷갈림)가 적은 쪽',
      '- clarity: 무슨 일이 일어나는지와 할 일이 분명했던 쪽',
      '- control: 사람이 방향을 쥐고 원하는 대로 이끈 쪽',
      '- recovery: 문제(비정상 종료, 방향 전환, 잘못된 수정)에서 되돌리거나 이어 가기 쉬웠던 쪽. 그런 일이 없으면 n/a',
      '- confidence: 사람이 결과를 믿을 근거를 더 얻은 쪽',
      '- overall: 이 상황에서 전체로 더 나은 사용 경험',
      'A_score, B_score는 전체 사용 경험 1~10이다. 결과의 정확성은 참고만 하고 사용 경험을 본다.',
      '',
      scenarioBrief(scenario),
      '',
      '## 기록 A',
      timeline(A, Ad),
      '',
      '## 기록 B',
      timeline(B, Bd),
    ].join('\n'),
  })

  const o = outcome.data
  const e = experience.data
  return {
    scenario: scenario.id,
    index: first.index,
    pair,
    flip,
    outcome: {
      [pair[0]]: flip ? o.B : o.A,
      [pair[1]]: flip ? o.A : o.B,
      preferred: nameOf(o.preferred),
      reason: o.reason,
    },
    experience: {
      ...Object.fromEntries(
        DIMENSIONS.map((d) => [d, { winner: nameOf(e[d].winner), note: e[d].note }]),
      ),
      scores: { [pair[0]]: flip ? e.B_score : e.A_score, [pair[1]]: flip ? e.A_score : e.B_score },
      reason: e.reason,
    },
    costUsd: outcome.costUsd + experience.costUsd,
  }
}

export { DIMENSIONS }
