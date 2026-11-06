// 장기 평가(sequence)를 돌리는 길: 걸음의 차례와 이어 돌기, 사람 역할의 기억(다시 말하기 PM1), 누적 숨긴 시험, 기준 브랜치에
// 넣기, 구조 지표, M3 장치 지표, 집계(m3-primary.mjs) (docs/eval.md 5절 '장기 평가 돌리기', relay-v3 docs/m3-design.md 6절).
// 모델을 부르지 않는다. 이어 돌기는 건식(정답 패치)으로 작은 열을 실제 git과 체크포인트로 돈다. 시나리오 48의 봉인 파일은
// 읽지 않는다(여기 열은 시험이 지어낸 것이다).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildHistory,
  changedBuild,
  changedFixed,
  configCopy,
  previousConfig,
  sequenceJobs,
} from '../run-sequence.mjs'
import {
  deviceCounts,
  m3Compare,
  m3Report,
  m3Verdict,
  M3_METRICS,
  permutationP,
  perWorkRows,
  retellsOf,
  v35Rows,
  withFlags,
} from '../m3-primary.mjs'
import { endCriterion, sequenceGuide, systemPrompt } from '../lib/human.mjs'
import {
  ledgerMetrics,
  m3WorkMetrics,
  parseLedger,
  REQUEST_SECTIONS,
  repoM3,
  repoRules,
  requestSections,
} from '../lib/m3-metrics.mjs'
import { endReasons } from '../lib/relay3-devices.mjs'
import { prepareMerge, relay3FakeGh } from '../lib/fake-gh.mjs'
import { RELAY3_APP, Relay3Arm, relay3AppOf, workLabel } from '../lib/relay3-arm.mjs'
import { relay3Env } from '../lib/kind.mjs'
import {
  cumulativeSummary,
  doneWorks,
  emptyMemory,
  keptChecks,
  nextStep,
  personaKnowledge,
  personaScenario,
  rememberWork,
  sealedPass,
} from '../lib/sequence.mjs'
import { landCli, restoreCheckpoint, saveCheckpoint } from '../lib/sequence-git.mjs'
import { envMarks, evalMarks, outsideReach, runSealedTask } from '../lib/sealed-run.mjs'
import {
  agentMemory,
  composeRun,
  jobPaths,
  landRelay3,
  runJob,
  workAudit,
} from '../lib/sequence-run.mjs'
import { duplicateDefinitions, duplication, structureMetrics } from '../lib/structure.mjs'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})
const tmp = (name) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `m3-seq-${name}-`))
  dirs.push(d)
  return d
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
const write = (root, files) => {
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.writeFileSync(path.join(root, f), text)
  }
}
const initRepo = (r) => {
  git(r, 'init', '-q', '-b', 'main')
  git(r, 'config', 'user.email', 'a@b')
  git(r, 'config', 'user.name', 'a')
  git(r, 'config', 'commit.gpgsign', 'false')
}

const check = (name) => ({ name, file: `${name}.test.js` })
const seq = {
  id: 't-seq',
  type: 'general',
  sequence: { chain: true, persona: 'continuous' },
  rules: [
    { id: 'R1', text: '규칙 하나' },
    { id: 'R2', text: '옛 규칙', changes: [{ work: 3, text: '새 규칙' }] },
  ],
  works: [
    { type: 'feature', report: 'a 요청\n둘째 줄', rules: ['R1', 'R2'], checks: [check('a1')] },
    { report: 'b 요청', rules: ['R1'], checks: [check('b1')] },
    { report: 'c 요청', rules: ['R2', 'R1'], retires: ['a1'], checks: [check('c1')] },
    { report: 'd 요청', rules: ['R2'], checks: [check('d1')] },
  ],
}

describe('걸음의 차례와 이어 돌기', () => {
  it('Work를 차례로, 다 끝나면 봉인 과제를 차례로, 그 뒤 구조 지표', () => {
    const o = { works: 3, sealed: ['s1', 's2'] }
    expect(nextStep({}, o)).toEqual({ kind: 'work', n: 0 })
    // 뒤 Work가 끝났다고 적혀 있어도 앞 Work부터 한다(앞 Work가 다음 Work의 기준이다)
    expect(nextStep({ works: { 1: { done: true } } }, o)).toEqual({ kind: 'work', n: 0 })
    const works = { 0: { done: true }, 1: { done: true }, 2: { done: true } }
    expect(nextStep({ works }, o)).toEqual({ kind: 'sealed', id: 's1' })
    expect(nextStep({ works, sealed: { s1: { done: true } } }, o)).toEqual({
      kind: 'sealed',
      id: 's2',
    })
    const sealed = { s1: { done: true }, s2: { done: true } }
    expect(nextStep({ works, sealed }, o)).toEqual({ kind: 'structure' })
    expect(nextStep({ works, sealed, structure: { done: true } }, o)).toBeNull()
    expect(nextStep({ works }, { ...o, runSealed: false })).toEqual({ kind: 'structure' })
  })

  it('until(작은 시범)이면 그 Work까지만 하고 봉인 과제와 구조 지표는 하지 않는다', () => {
    const o = { works: 3, sealed: ['s1'], until: 2 }
    expect(nextStep({ works: { 0: { done: true } } }, o)).toEqual({ kind: 'work', n: 1 })
    expect(nextStep({ works: { 0: { done: true }, 1: { done: true } } }, o)).toBeNull()
    expect(doneWorks({ works: { 0: { done: true }, 2: { done: true } } }, 3)).toBe(1)
  })

  it('장기 평가의 쪽: relay3-m2는 같은 빌드(RELAY3_APP)에서 RELAY_M3=off, relay3는 앱 기본', () => {
    expect(relay3Env('relay3-m2')).toEqual({ RELAY_M3: 'off' })
    expect(relay3Env('relay3')).toEqual({})
    expect(relay3AppOf('relay3-m2')).toBe(RELAY3_APP)
  })

  it('이어 돌 때 고정 값(모델, 기준 에이전트, 건식, 덧씌우기)이 바뀌면 알린다', () => {
    const a = { agentModel: 'sonnet', baseline: { model: 'sonnet', minutes: 30 }, dry: false }
    expect(changedFixed(null, a)).toEqual([])
    expect(changedFixed(a, { ...a, runs: 5 })).toEqual([])
    expect(changedFixed(a, { ...a, baseline: { model: 'opus', minutes: 30 } })).toEqual([
      'baseline',
    ])
  })

  it('결과 폴더가 없어지면(컨테이너가 다시 뜸) 체크포인트 폴더의 설정 사본으로 고정 값과 빌드를 확인한다', () => {
    const out = tmp('cfg-out')
    const cps = tmp('cfg-cps')
    expect(previousConfig(out, cps, 's')).toBeNull()
    const old = { agentModel: 'sonnet', builds: [{ appCommits: { relay3: 'a0b39e9' } }] }
    fs.mkdirSync(path.dirname(configCopy(cps, 's')), { recursive: true })
    fs.writeFileSync(configCopy(cps, 's'), JSON.stringify(old))
    const prev = previousConfig(out, cps, 's')
    expect(prev).toEqual(old)
    expect(changedBuild(prev, { appCommits: { relay3: 'b3ff42a' } }, ['relay3'])).toEqual([
      'relay3',
    ])
    expect(changedFixed(prev, { agentModel: 'opus' })).toEqual(['agentModel'])
    // 결과 폴더의 것이 있으면 그것이 먼저다
    fs.writeFileSync(path.join(out, 'config.json'), JSON.stringify({ agentModel: 'opus' }))
    expect(previousConfig(out, cps, 's')).toEqual({ agentModel: 'opus' })
  })
})

describe('사람 역할의 기억 (PM1)', () => {
  it('처음은 물으면 답함. 실제로 말한 규칙만 다음 Work에서 이미 말함이다', () => {
    let m = emptyMemory()
    const k0 = personaKnowledge(seq, 0, m)
    expect(k0.map((k) => `${k.rule}:${k.share}`)).toEqual(['R1:on_ask', 'R2:on_ask'])
    // R1만 말했다(에이전트가 R2는 묻지 않음)
    m = rememberWork(m, seq, 0, k0, [1], 'done')
    const k1 = personaKnowledge(seq, 1, m)
    expect(k1).toEqual([{ share: 'told', text: '규칙 하나', rule: 'R1', carry: true }])
    // 이미 말한 R1을 또 말하면 다시 말함(retold)
    m = rememberWork(m, seq, 1, k1, [1], 'done')
    expect(m.retold).toEqual([{ work: 2, rule: 'R1' }])
    expect(m.works.map((w) => [w.work, w.title, w.ending])).toEqual([
      [1, 'a 요청', 'done'],
      [2, 'b 요청', 'done'],
    ])
  })

  it('말하지 않은 규칙은 다음 Work에서도 물으면 답함, 바뀌는 Work는 처음부터 앎이고 그 뒤는 새 글로 이미 말함', () => {
    let m = rememberWork(emptyMemory(), seq, 0, personaKnowledge(seq, 0), [], 'done')
    m = rememberWork(m, seq, 1, personaKnowledge(seq, 1, m), [], 'timeout')
    // R2는 Work 1에서 말하지 않았고 Work 3에서 바뀐다: 요청이 새 규칙을 말한다
    const k2 = personaKnowledge(seq, 2, m)
    expect(k2.map((k) => `${k.rule}:${k.share}`)).toEqual(['R2:upfront', 'R1:on_ask'])
    m = rememberWork(m, seq, 2, k2, [], 'done')
    expect(m.rules.R2).toEqual({ text: '새 규칙', work: 3 })
    expect(personaKnowledge(seq, 3, m)).toEqual([
      { share: 'told', text: '새 규칙', rule: 'R2', carry: true },
    ])
    // 옛 글을 말한 것은 새 글을 말한 것이 아니다
    const old = { rules: { R2: { text: '옛 규칙', work: 1 } }, works: [], retold: [] }
    expect(personaKnowledge({ ...seq, works: seq.works.map((w) => ({ ...w })) }, 3, old)).toEqual([
      { share: 'on_ask', text: '새 규칙', rule: 'R2' },
    ])
  })

  it('사람 역할의 글: 앞서 한 일과 이미 말함, 끝의 기준, relay-v3 설명서의 끝은 [머지]와 빚 규칙', () => {
    let m = rememberWork(emptyMemory(), seq, 0, personaKnowledge(seq, 0), [1, 2], 'done')
    const ws = personaScenario(seq, 1, m)
    const text = systemPrompt('cli', ws, '설명서', 'cli')
    expect(text).toContain('이 레포에서 요청 4개를 차례로 처리하고 있다. 이번이 2번째 일이다')
    expect(text).toContain('### 앞서 한 일 (네 기억)\n- 1번째 일: a 요청 (끝냄)')
    expect(text).toContain('- 1. [이미 말함] 규칙 하나')
    expect(text).toContain('브랜치에 커밋했으면 다음 일 전에 도구가 main에 합친다')
    expect(endCriterion('relay3', ws)).toContain('앱의 [머지]로 main에 머지된 상태')
    // 장기 평가가 아닌 시나리오의 끝의 기준은 그대로다
    expect(endCriterion('relay3', { type: 'bugfix' })).toBe(
      '버그가 고쳐졌다고 네가 납득하고, 고친 내용이 로컬 브랜치에 커밋된 상태. 원격 push나 PR은 하지 않는다(원격 저장소가 평가용이다).',
    )
    const guide = fs.readFileSync(path.join(import.meta.dirname, '../guides/relay3.md'), 'utf8')
    const g = sequenceGuide(guide)
    expect(g).not.toContain('이 평가에서는 PR을 만들 수 없다')
    expect(g).toContain('[증거]의 [머지]를 누른다')
    expect(g).toContain('늘 [빚으로 남기고 머지]')
    // 일반 설명서의 [끝내기] 상자 설명(V35 전의 [세션에 넘기기]: 상자를 닫음)은 장기 평가 설명서에 들지 않는다. [증거]의
    // [세션에 넘기기](끝을 걸지 않음, V35)는 남는다
    expect(guide).toContain('그 올림을 세션에 보내고 상자를 닫는다')
    expect(g).not.toContain('그 올림을 세션에 보내고 상자를 닫는다')
    expect(g).not.toContain('[그래도 끝내기](이 커밋 그대로 끝냄)')
    expect(g).toContain('그 지적 옆의 [세션에 넘기기]를 누르거나')
    expect(g).toContain('[취소]나 [더 고치기]로 풀고')
    // 끝 항목 뒤의 항목은 남는다
    expect(g).toContain('- 세션이 멈추면')
    expect(() => sequenceGuide('- 화면: 없음')).toThrow()
  })
})

describe('누적 숨긴 시험과 봉인 과제의 판정', () => {
  it('그 Work의 시험과 앞 Work의 시험(깨진 것은 이름)', () => {
    const defs = [
      { name: 'a1', regression: true },
      { name: 'b1', regression: true },
      { name: 'c1' },
    ]
    const checks = [
      { name: 'a1', pass: true },
      { name: 'b1', pass: false },
      { name: 'c1', pass: true },
    ]
    expect(cumulativeSummary(defs, checks)).toEqual({
      total: 3,
      pass: 2,
      own: { total: 1, pass: 1 },
      regression: { total: 2, pass: 1 },
      broken: ['b1'],
      regressed: [],
    })
    // 바로 앞 Work를 끝낸 main에서 b1이 통과했으면 이 Work가 깨뜨린 것이다. 처음부터 실패한 것은 깨뜨린 것이 아니다
    const prev = [
      { name: 'a1', pass: false },
      { name: 'b1', pass: true },
    ]
    expect(cumulativeSummary(defs, checks, prev).regressed).toEqual(['b1'])
    expect(cumulativeSummary(defs, [{ name: 'c1', pass: true }], prev).regressed).toEqual(['b1'])
  })

  it('봉인 과제는 그 과제의 시험과 뺀 것을 뺀 누적 시험이 모두 통과해야 통과', () => {
    const last = [{ name: 'a1' }, { name: 'b1' }, { name: 'c1' }]
    expect(keptChecks(last, { retires: ['b1'] }).map((c) => c.name)).toEqual(['a1', 'c1'])
    expect(sealedPass([{ pass: true }], [{ pass: true }])).toBe(true)
    expect(sealedPass([{ pass: true }], [{ pass: false }])).toBe(false)
    expect(sealedPass([], [])).toBeNull()
  })
})

describe('기준 브랜치에 넣기', () => {
  const repoWithRemote = () => {
    const root = tmp('land')
    const r = path.join(root, 'r')
    fs.mkdirSync(r)
    initRepo(r)
    write(r, { 'a.js': 'a\n' })
    git(r, 'add', '.')
    git(r, 'commit', '-qm', 'base')
    git(root, 'init', '-q', '--bare', '-b', 'main', 'r.git')
    git(r, 'remote', 'add', 'origin', path.join(root, 'r.git'))
    git(r, 'push', '-q', '-u', 'origin', 'main')
    return { root, r }
  }

  it('맨 CLI: 커밋하지 않은 변경을 커밋하고 브랜치를 main에 머지해 push한다', () => {
    const { r } = repoWithRemote()
    git(r, 'checkout', '-q', '-b', 'fix')
    write(r, { 'b.js': 'b\n' })
    git(r, 'add', '.')
    git(r, 'commit', '-qm', 'b')
    write(r, { 'c.js': 'c\n' })
    const l = landCli(r, 'Work 1')
    expect(l).toMatchObject({ via: 'harness', leftovers: 1, merged: ['fix'], failed: [] })
    expect(git(r, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
    expect(git(r, 'rev-parse', 'origin/main')).toBe(l.head)
    expect(git(r, 'ls-tree', '--name-only', 'main').split('\n').sort()).toEqual([
      'a.js',
      'b.js',
      'c.js',
    ])
    // 넣을 것이 없으면 그대로다
    expect(landCli(r, 'Work 2')).toMatchObject({ leftovers: 0, merged: [], head: l.head })
  })

  it('relay-v3: 앱이 squash로 머지한 것은 가져오고, 머지되지 않은 Work 브랜치만 도구가 넣는다. 버린 Work는 넣지 않는다', () => {
    const { r } = repoWithRemote()
    const branch = (name, file) => {
      git(r, 'checkout', '-q', '-b', name, 'main')
      write(r, { [file]: `${file}\n` })
      git(r, 'add', '.')
      git(r, 'commit', '-qm', file)
      git(r, 'push', '-q', 'origin', name)
      git(r, 'checkout', '-q', 'main')
    }
    branch('relay/a-1111', 'x.js')
    branch('relay/b-2222', 'y.js')
    branch('relay/c-3333', 'z.js')
    // 앱의 [머지]: 가짜 gh가 원격에서 squash로 머지한다(로컬 main은 그대로)
    const m = prepareMerge(
      git(r, 'config', '--get', 'remote.origin.url'),
      { number: 1, title: 'a', headRefName: 'relay/a-1111', baseRefName: 'main' },
      'squash',
    )
    git(m.repo, 'push', '-q', 'origin', 'HEAD:refs/heads/main')
    fs.rmSync(m.work, { recursive: true, force: true })
    const l = landRelay3(
      r,
      [
        { branch: 'relay/a-1111', merged: true, abandoned: false },
        { branch: 'relay/b-2222', merged: false, abandoned: false },
        { branch: 'relay/c-3333', merged: false, abandoned: true },
      ],
      'Work 1',
    )
    expect(l).toMatchObject({ via: 'app+harness', app: ['relay/a-1111'], merged: ['relay/b-2222'] })
    expect(l.sync.moved).toBe(true)
    const files = git(r, 'ls-tree', '--name-only', 'main').split('\n').sort()
    expect(files).toEqual(['a.js', 'x.js', 'y.js'])
    // squash 머지된 브랜치는 main의 조상이 아니어도 다시 넣지 않는다(커밋이 둘로 들지 않음)
    expect(Number(git(r, 'rev-list', '--count', 'main'))).toBe(4)
  })

  it('가짜 gh의 머지: 충돌하면 머지할 수 없음(null)', () => {
    const { r } = repoWithRemote()
    git(r, 'checkout', '-q', '-b', 'relay/x-1', 'main')
    write(r, { 'a.js': 'x\n' })
    git(r, 'commit', '-qam', 'x')
    git(r, 'push', '-q', 'origin', 'relay/x-1')
    git(r, 'checkout', '-q', 'main')
    write(r, { 'a.js': 'y\n' })
    git(r, 'commit', '-qam', 'y')
    git(r, 'push', '-q', 'origin', 'main')
    const remote = git(r, 'config', '--get', 'remote.origin.url')
    const pr = { number: 2, headRefName: 'relay/x-1', baseRefName: 'main' }
    for (const method of ['merge', 'squash', 'rebase'])
      expect(prepareMerge(remote, pr, method)).toBeNull()
  })

  it('체크포인트는 같은 절대 경로로 돌아가고 판정·스크린샷·사람 설정·대화 기록은 빼고 node_modules는 어디서든 뺀다', () => {
    const root = tmp('ckpt')
    const w = path.join(root, 'work')
    write(w, {
      'repo/src/judge/keep.js': 'k\n',
      'judge/x': 'x',
      'cfg-human-1/a': 'a',
      'cfg-agent/projects/p/s.jsonl': '{}',
      'cfg-agent/projects/p/memory/m.md': 'm',
      'repo/node_modules/z.js': 'z',
      'state.json': '{}',
    })
    const file = saveCheckpoint([w], path.join(root, 'c.tar.gz'))
    write(w, { 'later.txt': 'later' })
    restoreCheckpoint(file, [w])
    const has = (f) => fs.existsSync(path.join(w, f))
    expect(has('state.json') && has('repo/src/judge/keep.js')).toBe(true)
    expect(has('cfg-agent/projects/p/memory/m.md')).toBe(true)
    expect([
      has('later.txt'),
      has('judge/x'),
      has('cfg-human-1/a'),
      has('cfg-agent/projects/p/s.jsonl'),
      has('repo/node_modules/z.js'),
    ]).toEqual([false, false, false, false, false])
  })
})

/** 작은 장기 평가 시나리오(Work 셋, 봉인 과제 하나)와 정답 패치를 짓는다 */
function tinyScenario() {
  const dir = tmp('scenario')
  const base = {
    'package.json': JSON.stringify({ name: 't', type: 'module', scripts: { test: 'node --test' } }),
    'src/calc.js': 'export const add = (a, b) => a + b\n',
    'test/calc.test.js':
      "import test from 'node:test'\nimport assert from 'node:assert'\nimport { add } from '../src/calc.js'\ntest('add', () => assert.equal(add(1, 2), 3))\n",
  }
  write(path.join(dir, 'repo'), base)
  const steps = [
    ['sub', 'a - b', 3],
    ['mul', 'a * b', 18],
    ['div', 'a / b', 2],
  ]
  // 정답을 차례로 쌓은 레포 위의 diff
  const work = path.join(dir, 'build')
  write(work, base)
  initRepo(work)
  git(work, 'add', '.')
  git(work, 'commit', '-qm', 'base')
  const addFn = (name, body, patch) => {
    fs.appendFileSync(path.join(work, 'src/calc.js'), `export const ${name} = (a, b) => ${body}\n`)
    fs.writeFileSync(patch, `${git(work, 'diff')}\n`)
    git(work, 'commit', '-qam', name)
  }
  const hidden = (where, name, expr, want) =>
    write(dir, {
      [`${where}/${name}.test.js`]: `import test from 'node:test'\nimport assert from 'node:assert'\nimport * as c from '../src/calc.js'\ntest('${name}', () => assert.equal(${expr}, ${want}))\n`,
    })
  steps.forEach(([name, body, want], i) => {
    addFn(name, body, path.join(dir, `reference-${i + 1}.patch`))
    hidden('hidden', `h${i + 1}`, `c.${name}?.(6, 3)`, want)
  })
  fs.mkdirSync(path.join(dir, 'sealed'), { recursive: true })
  addFn('pow', 'a ** b', path.join(dir, 'sealed/reference-s1.patch'))
  hidden('sealed/hidden', 's1', 'c.pow?.(2, 3)', 8)
  write(dir, {
    'sealed/tasks.json': JSON.stringify({
      tasks: [{ id: 's1', type: 'feature', report: 'pow', checks: [check('s1')], retires: ['h1'] }],
    }),
  })
  const scenario = {
    id: 't-tiny',
    type: 'feature',
    repoName: 'calc',
    sequence: { chain: true, persona: 'continuous', sealed: { dir: 'sealed', tasks: 1 } },
    rules: [{ id: 'R1', text: '나누기는 정수가 아니어도 된다' }],
    works: steps.map(([name], i) => ({
      report: `${name} 함수`,
      rules: i === 1 ? [] : ['R1'],
      checks: [{ name: `h${i + 1}`, file: `h${i + 1}.test.js` }],
    })),
    expectedFiles: ['src/**', 'test/**'],
  }
  return { dir, scenario }
}

describe('이어 돌기 (건식, 실제 git과 체크포인트)', () => {
  it('Work를 차례로 하고 끊기면 체크포인트에서 그 Work부터 다시 하고, 끝나면 봉인 과제와 구조 지표를 센다', async () => {
    const { dir, scenario } = tinyScenario()
    const out = tmp('out')
    const o = {
      scenario,
      scenarioDir: dir,
      arm: 'cli',
      index: 1,
      opts: { dry: true, baseline: { model: 'x', effort: 'low', minutes: 1 } },
      outDir: out,
      workRoot: tmp('work'),
      checkpoints: path.join(out, 'checkpoints'),
      log: () => {},
    }
    const p = jobPaths(o)
    // 작은 시범: Work 1만
    const first = await runJob({ ...o, until: 1 })
    expect(first.works.map((w) => w.work)).toEqual([1])
    expect(first.complete).toBe(false)
    // Work 2를 하다 끊긴 것처럼: 걸음을 적고 레포를 더럽힌다
    const stateFile = path.join(p.resultDir, 'state.json')
    const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        ...st,
        inProgress: { kind: 'work', n: 1 },
        attempts: { ...st.attempts, 'work-02': 1 },
      }),
    )
    write(p.repo, { 'junk.js': 'junk\n' })
    const all = await runJob(o)
    expect(fs.existsSync(path.join(p.repo, 'junk.js'))).toBe(false)
    expect(all.complete).toBe(true)
    expect(all.attempts['work-02']).toBe(2)
    expect(
      all.works.map((w) => [w.work, w.cumulative.pass, w.cumulative.total, w.landing.via]),
    ).toEqual([
      [1, 1, 1, 'harness'],
      [2, 2, 2, 'harness'],
      [3, 3, 3, 'harness'],
    ])
    // 건식 사람은 물으면 답함을 말한다: R1은 Work 1에서 말했으니 Work 3에서는 이미 말함(carry)이고 다시 말하지 않았다
    expect(all.works[2].knowledge).toEqual([{ share: 'told', rule: 'R1', carry: true }])
    expect(all.retold).toEqual([])
    // 봉인 과제: 정답에서 통과, 뺀 누적 시험(h1)은 돌지 않는다. 시험 이름과 출력은 남기지 않는다
    expect(all.sealed).toHaveLength(1)
    expect(all.sealed[0]).toMatchObject({ id: 's1', pass: true, own: { total: 1, pass: 1 } })
    expect(all.sealed[0].kept.checks.map((c) => c.name)).toEqual(['h2', 'h3'])
    expect(JSON.stringify(all.sealed[0].own)).not.toContain('s1.test')
    expect(JSON.stringify(all)).not.toContain('assert')
    expect(all.structure.final.lines).toBeGreaterThan(all.structure.base.lines)
    // 다 끝난 줄을 다시 돌리면 아무것도 하지 않는다
    const again = await runJob(o)
    expect(again.attempts).toEqual(all.attempts)
    // 모음은 결과 폴더만으로 다시 만들 수 있다
    expect(
      composeRun(p.resultDir, JSON.parse(fs.readFileSync(stateFile, 'utf8')), 3, [{ id: 's1' }])
        .complete,
    ).toBe(true)
  })
})

const RELAY3_GH = relay3FakeGh(RELAY3_APP)

describe('relay-v3 쪽의 뒤 Work: 앞 Work의 worktree와 브랜치', () => {
  it("앞 Work(earlier)의 worktree·브랜치·스냅숏은 이 Work의 판정 폴더와 '바뀐 코드'에 들지 않는다", () => {
    const root = tmp('earlier')
    const repo = path.join(root, 'shop')
    fs.mkdirSync(repo)
    initRepo(repo)
    fs.writeFileSync(path.join(repo, 'a.js'), 'a\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'base')
    const home = path.join(root, 'relay3-home')
    const work = (id, branch, file) => {
      const wt = path.join(home, 'worktrees', id)
      git(repo, 'worktree', 'add', '-q', '-b', branch, wt, 'main')
      fs.writeFileSync(path.join(wt, file), `${file}\n`)
      git(wt, 'add', '.')
      git(wt, 'commit', '-qm', file)
      fs.mkdirSync(path.join(home, 'works', id), { recursive: true })
      fs.writeFileSync(
        path.join(home, 'works', id, 'work.json'),
        JSON.stringify({ id, state: 'done', branch, worktree: wt }),
      )
    }
    // 앞 Work: 브랜치를 squash로 main에 넣었다(브랜치의 커밋은 main의 조상이 아니다)
    const old = '11111111-0000-4000-8000-000000000000'
    work(old, 'relay/old-1111', 'b.js')
    git(repo, 'merge', '-q', '--squash', 'relay/old-1111')
    git(repo, 'commit', '-qm', 'squash old')
    const base = git(repo, 'rev-parse', 'main')
    const now = '22222222-0000-4000-8000-000000000000'
    work(now, 'relay/now-2222', 'c.js')
    const arm = new Relay3Arm({ dir: root, repo, base, agentEnv: {}, agentConfigDir: root })
    // 고치기 전의 모습: 앞 Work의 worktree도 판정 폴더다(지금 main과 달라 '바뀐 코드'에 거꾸로 보인다)
    expect(
      arm
        .finalTrees()
        .map((t) => t.label)
        .sort(),
    ).toEqual([workLabel(0, old), workLabel(0, now)].sort())
    arm.snapshot()
    arm.earlier = new Set([workLabel(0, old)])
    const trees = arm.finalTrees()
    expect(trees.map((t) => t.label)).toEqual([workLabel(0, now)])
    // 앞 Work의 worktree를 지워도 그 브랜치와 스냅숏은 들지 않는다
    git(repo, 'worktree', 'remove', '--force', path.join(home, 'worktrees', old))
    expect(arm.finalTrees().map((t) => t.label)).toEqual([workLabel(0, now)])
    expect(arm.unmeasuredBranches()).toEqual([])
  })
})

describe('relay-v3 쪽의 넣기 (건식, 가짜 gh)', () => {
  // relay-v3 체크아웃(RELAY3_APP)의 가짜 gh가 있어야 돈다(relay-v2만 받은 CI에는 없다)
  it.skipIf(!fs.existsSync(RELAY3_GH))(
    '작업 브랜치를 push하고 PR을 열어 squash로 머지하면 원격 main이 움직이고 도구는 가져오기만 한다',
    async () => {
      const { dir, scenario } = tinyScenario()
      const out = tmp('out3')
      const r = await runJob({
        scenario,
        scenarioDir: dir,
        arm: 'relay3',
        index: 1,
        opts: { dry: true, relay3App: RELAY3_APP, baseline: {} },
        outDir: out,
        workRoot: tmp('work3'),
        checkpoints: path.join(out, 'checkpoints'),
        until: 2,
        log: () => {},
      })
      expect(r.works.map((w) => [w.landing.via, w.landing.app, w.landing.merged])).toEqual([
        ['app', ['relay/dry-w01'], []],
        ['app', ['relay/dry-w02'], []],
      ])
      expect(r.works.map((w) => `${w.cumulative.pass}/${w.cumulative.total}`)).toEqual([
        '1/1',
        '2/2',
      ])
      const state = JSON.parse(
        fs.readFileSync(
          path.join(
            jobPaths({
              ...r,
              scenario,
              arm: 'relay3',
              index: 1,
              outDir: out,
              workRoot: '/x',
              checkpoints: '/x',
            }).resultDir,
            'state.json',
          ),
          'utf8',
        ),
      )
      expect(state.works[1].via).toBe('app')
    },
  )
})

/** root 아래(있으면)에서 이름이 name인 폴더나 파일의 경로들 */
const findNamed = (root, name) => {
  const out = []
  const walk = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue
      const p = path.join(d, e.name)
      if (e.name === name) out.push(p)
      if (e.isDirectory() && !e.isSymbolicLink()) walk(p)
    }
  }
  walk(root)
  return out
}

/** 기준 에이전트 대신: 과제의 정답 패치를 얹고 커밋한다. 부른 cwd와 그때 닿는 숨긴 시험을 적는다 */
const fakeBaseline =
  (dir, seen, ending = 'done') =>
  async ({ cwd }) => {
    seen.push({
      cwd,
      reach: findNamed(path.dirname(cwd), 'eval-hidden'),
    })
    if (ending === 'done') {
      execFileSync('git', ['apply', path.join(dir, 'sealed/reference-s1.patch')], { cwd })
      git(cwd, 'commit', '-qam', 'pow')
    }
    return {
      ending,
      ms: 0,
      costUsd: 0,
      result: null,
      error: ending === 'error' ? 'overloaded' : null,
    }
  }

describe('평가의 공정성 (숨긴 시험의 격리, 봉인 과제, 넣기, 이어 돌기의 고정)', () => {
  const job = (dir, scenario, extra = {}) => {
    const out = tmp('fair-out')
    return {
      scenario,
      scenarioDir: dir,
      arm: 'cli',
      index: 1,
      opts: { dry: true, baseline: { model: 'x', effort: 'low', minutes: 1 } },
      outDir: out,
      workRoot: tmp('fair-work'),
      checkpoints: path.join(out, 'checkpoints'),
      log: () => {},
      ...extra,
    }
  }

  it('Work를 판정한 뒤 숨긴 시험은 줄의 작업 폴더에 남지 않는다(다음 Work의 에이전트가 닿지 않게)', async () => {
    const { dir, scenario } = tinyScenario()
    const o = job(dir, scenario)
    const r = await runJob({ ...o, until: 2 })
    expect(r.works.map((w) => w.cumulative.pass)).toEqual([1, 2])
    const p = jobPaths(o)
    expect(findNamed(p.workDir, 'eval-hidden')).toEqual([])
    expect(findNamed(p.workDir, 'h1.test.js')).toEqual([])
  })

  it('봉인 과제의 기준 에이전트는 쪽의 작업 폴더 밖, 쪽 이름이 없는 폴더에서 돌고 숨긴 시험에 닿지 않으며 그 폴더는 지워진다', async () => {
    const { dir, scenario } = tinyScenario()
    const seen = []
    const o = job(dir, scenario, { sealedAgent: fakeBaseline(dir, seen) })
    const p = jobPaths(o)
    const r = await runJob(o)
    expect(r.sealed[0]).toMatchObject({ id: 's1', ending: 'done', pass: true })
    expect(seen).toHaveLength(1)
    const { cwd, reach } = seen[0]
    expect(cwd.startsWith(`${p.workDir}${path.sep}`)).toBe(false)
    expect(cwd).not.toContain(p.name)
    expect(reach).toEqual([])
    expect(findNamed(p.workDir, 'eval-hidden')).toEqual([])
    expect(fs.existsSync(path.dirname(cwd))).toBe(false)
  })

  it('기준 에이전트가 평가의 자리(시나리오 폴더, 판정 임시 폴더)를 가리킨 도구 호출을 센다(격리 감사)', async () => {
    const { dir, scenario } = tinyScenario()
    const base = fakeBaseline(dir, [])
    // 대화 기록: 레포 안의 호출 하나, 시나리오의 봉인 폴더를 읽는 호출 하나(같은 id의 줄이 둘), 판정 임시 폴더를 찾는 호출 하나
    const peek = async (a) => {
      const use = (id, command) =>
        JSON.stringify({
          message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] },
        })
      const p = path.join(a.configDir, 'projects', 'x')
      fs.mkdirSync(p, { recursive: true })
      fs.writeFileSync(
        path.join(p, 's.jsonl'),
        [
          use('t1', 'npm test'),
          use('t2', `cat ${path.join(dir, 'sealed/hidden')}/*`),
          use('t2', `cat ${path.join(dir, 'sealed/hidden')}/*`),
          use('t3', 'ls /tmp/relay-judge-*'),
        ].join('\n'),
      )
      return base(a)
    }
    const r = await runJob(job(dir, scenario, { sealedAgent: peek }))
    expect(r.sealed[0].outside).toEqual({ calls: 3, reach: 2, seen: 0, github: 0 })
    const clean = await runJob(job(dir, scenario, { sealedAgent: base }))
    expect(clean.sealed[0].outside).toEqual({ calls: 0, reach: 0, seen: 0, github: 0 })
    const { text } = m3Report([withFlags({ ...r, kind: 'cli' }, { works: 3, sealed: 1 })])
    expect(text).toMatch(/\| cli#1 \|.*\| s1 \|/)
  })

  it('기준 에이전트의 도구 오류는 과제의 실패가 아니라 도구 문제로 멈추고, 다시 돌리면 그 과제부터 한다', async () => {
    const { dir, scenario } = tinyScenario()
    const seen = []
    const o = job(dir, scenario)
    await expect(runJob({ ...o, sealedAgent: fakeBaseline(dir, seen, 'error') })).rejects.toThrow(
      /봉인 과제/,
    )
    const p = jobPaths(o)
    expect(fs.existsSync(path.join(p.resultDir, 'sealed-s1.json'))).toBe(false)
    const r = await runJob({ ...o, sealedAgent: fakeBaseline(dir, seen) })
    expect(r.complete).toBe(true)
    expect(r.sealed[0]).toMatchObject({ ending: 'done', pass: true })
    expect(r.attempts['sealed-s1']).toBe(2)
  })

  it('봉인 과제의 통과는 과제 전 마지막 main에서 이미 실패하던 누적 시험을 세지 않는다(그 수는 따로 남긴다)', async () => {
    const { dir, scenario } = tinyScenario()
    // Work 1의 정답만 든 원격: h2, h3은 과제 전부터 실패한다
    const root = tmp('sealed-pre')
    const r = path.join(root, 'r')
    fs.cpSync(path.join(dir, 'repo'), r, { recursive: true })
    initRepo(r)
    git(r, 'add', '.')
    git(r, 'commit', '-qm', 'base')
    execFileSync('git', ['apply', path.join(dir, 'reference-1.patch')], { cwd: r })
    git(r, 'commit', '-qam', 'w1')
    git(root, 'clone', '-q', '--bare', r, 'r.git')
    const finalTree = path.join(root, 'final')
    fs.cpSync(r, finalTree, { recursive: true, filter: (s) => !s.includes(`${path.sep}.git`) })
    const lastActive = scenario.works.map((w, i) => ({ ...w.checks[0], regression: i < 2 }))
    const task = { id: 's1', report: 'pow', checks: [check('s1')], retires: ['h1'] }
    // 기준 에이전트: pow를 더한다(h1을 깨뜨리지 않음)
    const agent = async ({ cwd }) => {
      fs.appendFileSync(path.join(cwd, 'src/calc.js'), 'export const pow = (a, b) => a ** b\n')
      git(cwd, 'commit', '-qam', 'pow')
      return { ending: 'done', ms: 0, costUsd: 0, result: null, error: null }
    }
    const s = await runSealedTask({
      task,
      scenario,
      scenarioDir: dir,
      remote: path.join(root, 'r.git'),
      finalTree,
      lastActive,
      runAgent: agent,
      opts: { model: 'x', effort: 'low', minutes: 1 },
    })
    expect(s.own).toMatchObject({ total: 1, pass: 1 })
    expect(s.kept).toMatchObject({ total: 2, pass: 0, preBroken: 2 })
    expect(s.pass).toBe(true)
    // 과제 전에 통과하던 누적 시험을 깨뜨리면 실패다
    expect(
      sealedPass(
        [{ name: 's', pass: true }],
        [{ name: 'a', pass: false }],
        [{ name: 'a', pass: true }],
      ),
    ).toBe(false)
    expect(
      sealedPass(
        [{ name: 's', pass: true }],
        [{ name: 'a', pass: false }],
        [{ name: 'a', pass: false }],
      ),
    ).toBe(true)
  })

  it('relay-v3: 머지되지 않고 버리지 않은 Work의 worktree에 커밋하지 않은 변경은 cli처럼 커밋해 넣는다', () => {
    const root = tmp('land3')
    const r = path.join(root, 'r')
    fs.mkdirSync(r)
    initRepo(r)
    write(r, { 'a.js': 'a\n' })
    git(r, 'add', '.')
    git(r, 'commit', '-qm', 'base')
    git(root, 'init', '-q', '--bare', '-b', 'main', 'r.git')
    git(r, 'remote', 'add', 'origin', path.join(root, 'r.git'))
    git(r, 'push', '-q', '-u', 'origin', 'main')
    const wt = (name, dirName) => {
      const d = path.join(root, 'worktrees', dirName)
      git(r, 'worktree', 'add', '-q', '-b', name, d, 'main')
      write(d, { [`${dirName}.js`]: `${dirName}\n` })
      git(d, 'add', '.')
      git(d, 'commit', '-qm', dirName)
      // 시간 제한으로 끝나 커밋하지 못한 것
      write(d, { [`${dirName}-half.js`]: 'half\n' })
      return d
    }
    const a = wt('relay/a-1111', 'a1')
    const c = wt('relay/c-3333', 'c3')
    const l = landRelay3(
      r,
      [
        { branch: 'relay/a-1111', worktree: a, merged: false, abandoned: false },
        { branch: 'relay/c-3333', worktree: c, merged: false, abandoned: true },
      ],
      'Work 1',
    )
    expect(l).toMatchObject({ via: 'harness', merged: ['relay/a-1111'], leftovers: 1 })
    expect(git(r, 'ls-tree', '--name-only', 'main').split('\n').sort()).toEqual([
      'a.js',
      'a1-half.js',
      'a1.js',
    ])
  })

  it('이어 돌 때 시간·차례 제한이 바뀌거나 relay-v3 빌드가 바뀌면 멈추고, 빌드는 덮어쓰지 않고 쌓는다', () => {
    const a = { agentModel: 'sonnet', maxMinutes: 40, maxTurns: undefined }
    expect(changedFixed(a, { ...a, maxMinutes: 60 })).toEqual(['maxMinutes'])
    expect(changedFixed(a, { ...a, maxTurns: 30 })).toEqual(['maxTurns'])
    const b1 = { commit: 'aaa', appCommits: { relay3: 'r1' }, claudeVersion: '2.1' }
    const prev = { builds: buildHistory(null, b1, 't1') }
    expect(changedBuild(prev, b1, ['relay3', 'cli'])).toEqual([])
    expect(changedBuild(prev, { ...b1, commit: 'bbb' }, ['relay3'])).toEqual([])
    expect(changedBuild(prev, { ...b1, appCommits: { relay3: 'r2' } }, ['relay3'])).toEqual([
      'relay3',
    ])
    // cli만 도는 열은 relay-v3 빌드(덧씌우기의 초안만 만든다)를 고정하지 않는다
    expect(changedBuild(prev, { ...b1, appCommits: { relay3: 'r2' } }, ['cli'])).toEqual([])
    // 예전 config(builds 없음)는 그 commit·appCommits를 첫 빌드로 본다
    expect(changedBuild(b1, { ...b1, appCommits: { relay3: 'r2' } }, ['relay3-m2'])).toEqual([
      'relay3',
    ])
    const h = buildHistory(prev, { ...b1, commit: 'bbb' }, 't2')
    expect(h.map((x) => [x.commit, x.at])).toEqual([
      ['aaa', 't1'],
      ['bbb', 't2'],
    ])
    expect(buildHistory({ builds: h }, { ...b1, commit: 'bbb' }, 't3')).toHaveLength(2)
  })
})

describe('구조 지표', () => {
  it('6줄 창의 글 중복과 두 파일에 같은 이름의 함수', () => {
    const body = ['const a = 1', 'const b = 2', 'const c = a + b', 'log(c)', 'log(a)', 'log(b)']
    const files = [
      {
        file: 'src/x.js',
        text: ['// x', ...body, '', 'export function formatWon(n) {', '}'].join('\n'),
      },
      { file: 'src/y.js', text: ['{', ...body, 'export function formatWon(m) {', '}'].join('\n') },
      { file: 'src/z.js', text: 'const won = (n) => n\nfunction other() {}\n' },
    ]
    const d = duplication(files)
    expect(d).toMatchObject({ window: 6, lines: 12, groups: 1 })
    // 뜻 있는 줄: x 7, y 7, z 2(주석, 빈 줄, 괄호만인 줄은 빼고)
    expect(d.ratio).toBeCloseTo(12 / 16)
    expect(duplicateDefinitions(files)).toEqual({
      count: 1,
      names: [{ name: 'formatWon', files: ['src/x.js', 'src/y.js'] }],
    })
  })

  it('가장 긴 파일, 상한을 넘는 파일, 줄 수(include만)', () => {
    const root = tmp('struct')
    write(root, {
      'src/a.js': 'x\n'.repeat(5),
      'src/b.js': 'y\n'.repeat(2),
      'test/a.test.js': 'z\n',
      'README.md': 'r\n'.repeat(50),
    })
    const s = structureMetrics(root, { include: ['src/**/*.js', 'test/**/*.js'], maxLines: 4 })
    expect(s).toMatchObject({
      files: 3,
      lines: 8,
      longest: { file: 'src/a.js', lines: 5 },
      over: { count: 1, files: ['src/a.js'] },
    })
  })
})

describe('M3 장치 지표', () => {
  // 절 제목이 앱과 어긋나면 relay3 쪽도 모든 절이 null로 읽혀 꺼진 쪽(relay3-m2)과 같아 보인다. 앱 체크아웃이 없으면 건너뛴다
  it.skipIf(!fs.existsSync(path.join(RELAY3_APP, 'src/engine/judge.ts')))(
    'request.md 절 제목이 relay-v3(RELAY3_APP)의 것과 같다',
    () => {
      const src = (f) => fs.readFileSync(path.join(RELAY3_APP, 'src/engine', f), 'utf8')
      const title = (f, name) =>
        new RegExp(`export const ${name} = '([^']+)'`).exec(src(f))?.[1] ?? null
      expect({
        knowledge: title('knowledge-format.ts', 'LIST_HEADING'),
        unrecorded: title('debt-record.ts', 'UNRECORDED_TITLE'),
        debt: title('tidy.ts', 'TIDY_TITLE'),
      }).toEqual(REQUEST_SECTIONS)
    },
  )

  it('request.md의 relay 절마다 항목 수. 절이 없으면 null', () => {
    const text = [
      '요청 글',
      '- 사람이 쓴 목록',
      '',
      '## 관련 지식 (relay가 고름)',
      '',
      '- 금액 (docs/knowledge/money.md)',
      '- 쿠폰 (docs/knowledge/coupon.md)',
      '',
      '## 기록 안 된 나빠짐 (relay가 찾음)',
      '앞 기록 뒤에 나빠진 채 들어온 것',
      '- file-size: src/a.js',
    ].join('\n')
    expect(requestSections(text)).toEqual({ knowledge: 2, unrecorded: 1, debt: null })
  })

  it('Work 하나: 스위치, 기록 안 된 나빠짐, 지식 확인, 근거, 빚 기록, 메모', () => {
    const m = m3WorkMetrics({
      rec: {
        m3: { knowledge: true, debt: true, tidy: false },
        unrecorded: ['a'],
        end_memos: [{}, {}],
      },
      events: [{ type: 'debt_recorded', items: ['d1', 'd2'], push: true }],
      request: '',
      final: {
        knowledge: {
          changed: ['docs/knowledge/a.md'],
          issues: [{ kind: 'format' }, { kind: 'not_yet' }],
        },
        groundings: [
          { line: 'C1', ground: { type: 'knowledge', id: 'a' }, ok: true },
          { line: 'C2', ground: { type: 'knowledge', id: 'b' }, ok: false },
          { line: 'C3', ground: { type: 'request', quote: 'x' }, ok: true },
        ],
        ratchets: [{ id: 'file-size', status: 'worse' }],
        debt_commit: { from: 'h', items: ['d1', 'd2'] },
      },
      all: [{ ratchets: [{ id: 'file-size', status: 'worse' }] }, { ratchets: [] }],
    })
    expect(m).toMatchObject({
      switches: { knowledge: true, debt: true, tidy: false },
      unrecorded: 1,
      knowledge: { changed: 1, format: 1, anchor: 0, notYet: 1 },
      groundings: { total: 2, found: 1 },
      debt: {
        recorded: 1,
        items: 2,
        pushed: 1,
        commit: 2,
        covered: null,
        worseBundles: 1,
        finalWorse: ['file-size'],
      },
      tidy: null,
      memos: 2,
    })
    // 장치를 끈 Work(옛 기록): 칸이 없다
    expect(m3WorkMetrics({ rec: {} })).toMatchObject({
      switches: null,
      unrecorded: null,
      knowledge: null,
    })
  })

  it('장부: 내보내기마다 마지막으로 받아들인 줄로 기록함·기록 안 함을 센다(relay-v3 acceptedUnrecorded)', () => {
    const text = [
      JSON.stringify({ work: 'w1', head: 'a', accepted: { ratchets: ['file-size'], debt: [] } }),
      JSON.stringify({
        work: 'w1',
        head: 'b',
        accepted: { ratchets: ['file-size'], debt: ['d1'] },
        merged_head: 'b',
        by: 'human',
      }),
      JSON.stringify({ work: 'w2', head: 'c', accepted: { ratchets: ['file-size'], debt: [] } }),
      JSON.stringify({ work: 'w3', head: 'd', merged_head: 'd', by: 'human' }),
      '{깨진 줄',
    ].join('\n')
    const entries = parseLedger(text)
    expect(ledgerMetrics(entries)).toMatchObject({
      accepted: 2,
      recorded: 1,
      unrecorded: 1,
      merged: 2,
      mergedBy: { human: 2 },
    })
    expect(ledgerMetrics(entries, ['w2'])).toMatchObject({ accepted: 1, unrecorded: 1, merged: 0 })
  })

  it('레포의 빚 장부(kind마다)와 지식 파일', () => {
    const root = tmp('repo-m3')
    write(root, {
      '.relay/debt/a.md': '---\nanchor.path: src/a.js\nkind: accepted_regression\n---\n까닭\n',
      '.relay/debt/b.md': '---\nkind: tidy\n---\n',
      'docs/knowledge/money.md': '# 금액\n',
      '.relay/quality.json': '{}',
    })
    expect(repoM3(root)).toEqual({
      debt: { items: 2, kinds: { accepted_regression: 1, tidy: 1 } },
      knowledge: 1,
      quality: true,
      rules: { items: 0, withCheck: 0, promotedItems: 0, promoted: [], rules: [] },
    })
  })

  it('끝의 까닭: 넘긴 끝, 푼 까닭, 메모', () => {
    expect(
      endReasons([
        { type: 'end_handed', head: 'a' },
        { type: 'end_cancelled', reason: 'human_input', handed: true },
        { type: 'end_handed', head: 'b' },
        { type: 'end_cancelled', reason: 'hand_failed', handed: true },
        { type: 'end_handed', head: 'c' },
        { type: 'ended', how: 'handed', head: 'c', memos: 2 },
      ]),
    ).toEqual({
      how: 'handed',
      handed: 3,
      endedHanded: true,
      cancelled: { human_input: 1, hand_failed: 1 },
      memos: 2,
    })
    expect(endReasons([])).toEqual({
      how: null,
      handed: 0,
      endedHanded: false,
      cancelled: {},
      memos: null,
    })
  })
})

/** 집계 시험의 줄: Work k개(누적 통과 비율), 봉인 과제(통과), 다시 말함 */
function fakeRun(arm, index, o) {
  return withFlags(
    {
      scenario: '48-long-shop',
      kind: arm,
      index,
      sequence: true,
      works: o.cum.map((rate, i) => ({
        work: i + 1,
        cumulative: { pass: Math.round(rate * 10), total: 10, broken: [] },
        landing: { via: arm === 'cli' ? 'harness' : 'app' },
        human: { turns: 4, carriedTold: 9, carriedToldAudit: i === 0 ? o.retell : 0 },
        agent: { input: 1000, cacheRead: 1000, cacheWrite: 0, output: 5 },
        appWorks: [],
      })),
      sealed: o.sealed.map((pass, k) => ({
        id: `s${k + 1}`,
        pass,
        wallMs: 60_000,
        agent: { input: 2000, cacheRead: 0, cacheWrite: 0 },
      })),
      structure: {
        final: {
          longest: { lines: 600 },
          over: { count: 0 },
          duplication: { ratio: 0 },
          definitions: { count: 1 },
        },
      },
      attempts: { 'work-01': index === 2 ? 2 : 1 },
    },
    { works: o.cum.length, sealed: 3 },
  )
}

describe('집계 (m3-primary)', () => {
  const runs = [
    fakeRun('relay3', 1, { cum: [1, 1], sealed: [true, true, true], retell: 0 }),
    fakeRun('relay3', 2, { cum: [1, 0.8], sealed: [true, true, false], retell: 1 }),
    fakeRun('relay3-m2', 1, { cum: [1, 0.5], sealed: [true, false, false], retell: 2 }),
    fakeRun('relay3-m2', 2, { cum: [0.5, 0.5], sealed: [false, false, false], retell: 3 }),
    fakeRun('cli', 1, { cum: [1], sealed: [], retell: 0 }),
  ]
  const metric = (k) => M3_METRICS.find((m) => m.key === k)

  it('줄마다 값: 봉인 과제 통과율·토큰·시간, 누적 통과, 다시 말하기(감사 우선)', () => {
    expect(retellsOf({ human: { carriedTold: 3, carriedToldAudit: 1 } })).toBe(1)
    expect(retellsOf({ human: { carriedTold: 3 } })).toBe(3)
    const r = runs[1]
    expect(metric('S1').of(r)).toBeCloseTo(2 / 3)
    expect(metric('S2').of(r)).toBe(2)
    expect(metric('S3').of(r)).toBe(1)
    expect(metric('C1').of(r)).toBeCloseTo(0.9)
    expect(metric('C2').of(r)).toBeCloseTo(0.8)
    expect(metric('PM1').of(r)).toBe(1)
    expect(metric('W1').of(r)).toBe(2)
    expect(r.retried).toEqual(['work-01'])
    // 봉인 과제가 없는 줄(덜 함)은 S 지표에서 빠진다. Work가 모자라도 C 지표에서 빠진다
    expect(metric('S1').of(runs[4])).toBeNull()
    expect(
      metric('C1').of(withFlags({ ...runs[4], kind: 'cli' }, { works: 15, sealed: 3 })),
    ).toBeNull()
  })

  it('짝의 차이는 줄을 단위로 한 bootstrap 구간과 동등 판정(δ)', () => {
    const c = m3Compare(runs, 'relay3', 'relay3-m2', metric('S1'))
    expect(c.diff).toBeCloseTo(5 / 6 - 1 / 6)
    expect(c.lo).toBeGreaterThan(0.1)
    expect(c.reading).toBe('다름')
    const same = m3Compare(runs, 'relay3', 'relay3', metric('C1'))
    expect(same.reading).toBe('같음')
    expect(m3Compare(runs, 'relay3', 'nobody', metric('S1'))).toBeNull()
  })

  it('보고서: 줄마다, 쪽마다 평균, 차이, Work마다 누적 통과. 봉인 과제는 id와 통과만', () => {
    const { text, comparisons } = m3Report(runs, { dirs: ['x'] })
    expect(text).toContain(
      '| relay3#2 | 2 | 2/3 (s1 O, s2 O, s3 X) | 8/10 | 1 / 0 | work-01 (?) | - | 0 / 0 / 0 |',
    )
    expect(text).toContain('| relay3 − relay3-m2 | **S1** |')
    expect(comparisons['relay3:relay3-m2:S1'].reading).toBe('다름')
    expect(perWorkRows(runs, ['relay3', 'cli'])[1]).toEqual(['2', '0.90 (n 2; app 2)', '-'])
  })
})

describe('규약 고정 전의 셈 (relay-v3 docs/experiments/m3/protocol.md 5.5, 6, 7, 9절)', () => {
  const metric = (k) => M3_METRICS.find((m) => m.key === k)
  const job = (dir, scenario, extra = {}) => {
    const out = tmp('proto-out')
    return {
      scenario,
      scenarioDir: dir,
      arm: 'cli',
      index: 1,
      opts: { dry: true, baseline: { model: 'x', effort: 'low', minutes: 1 } },
      outDir: out,
      workRoot: tmp('proto-work'),
      checkpoints: path.join(out, 'checkpoints'),
      log: () => {},
      ...extra,
    }
  }
  const transcript = (configDir, lines) => {
    const d = path.join(configDir, 'projects', 'k')
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, 's.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'))
  }
  const use = (id, command) => ({
    message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] },
  })
  const result = (id, text) => ({
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] },
  })

  it('순열 p: 3 대 3은 20가지 나눔이라 다 갈려도 0.1이고, 2 대 2는 1/3보다 작아지지 않는다', () => {
    expect(permutationP([1, 1, 1], [0, 0, 0])).toBeCloseTo(0.1)
    expect(permutationP([3, 2, 1], [6, 5, 4])).toBeCloseTo(0.1)
    expect(permutationP([1, 0, 1], [0, 1, 0])).toBeCloseTo(1)
    expect(permutationP([1, 1], [0, 0])).toBeCloseTo(1 / 3)
    expect(permutationP([], [1])).toBeNull()
  })

  it('읽기에 방향을 붙이고, 두 쪽 모든 줄이 같은 값이면 판정 없음(천장·바닥)', () => {
    const c = (diff, lo, hi) => ({ diff, lo, hi })
    expect(m3Verdict(c(0, 0, 0), metric('S1'), [1, 1, 1], [1, 1, 1])).toBe('판정 없음(천장)')
    expect(m3Verdict(c(0, 0, 0), metric('PM1'), [0, 0, 0], [0, 0, 0])).toBe('판정 없음(바닥)')
    expect(m3Verdict(c(0, 0, 0), metric('T1'), [599, 599], [599, 599])).toBe(
      '판정 없음(모두 같은 값)',
    )
    expect(m3Verdict(c(0.5, 0.3, 0.7), metric('S1'), [1, 1], [0.5, 0.5])).toBe('좋음')
    expect(m3Verdict(c(-2, -3, -1.5), metric('PM1'), [0, 0], [2, 2])).toBe('좋음')
    expect(m3Verdict(c(2, 1.5, 3), metric('PM1'), [2, 2], [0, 0])).toBe('나쁨')
    expect(m3Verdict(c(-5, -8, -1), metric('S2'), [1, 2], [6, 8])).toBe('좋음')
    expect(m3Verdict(c(0.02, -0.05, 0.08), metric('C1'), [0.9, 0.95], [0.9, 0.92])).toBe('같음')
    // T1~T4에도 δ가 있다(V40·V41의 끄는 조건)
    expect(['T1', 'T2', 'T3', 'T4'].map((k) => metric(k).delta)).toEqual([50, 1, 0.01, 1])
    // 판정 규칙에 드는 지표는 S1, C1, C2, PM1뿐이다(S2·S3는 보고만)
    expect(M3_METRICS.filter((m) => m.decides).map((m) => m.key)).toEqual(['S1', 'C1', 'C2', 'PM1'])
  })

  it('규칙에 드는 좋음·나쁨은 구간과 순열 p가 함께 맞을 때만이다(쪽마다 n 2면 들지 못한다)', () => {
    const line = (arm, index, sealed) => fakeRun(arm, index, { cum: [1], sealed, retell: 0 })
    const three = [
      line('relay3', 1, [true, true, true]),
      line('relay3', 2, [true, true, true]),
      line('relay3', 3, [true, true, false]),
      line('relay3-m2', 1, [false, false, false]),
      line('relay3-m2', 2, [true, false, false]),
      line('relay3-m2', 3, [false, false, false]),
    ]
    const c = m3Compare(three, 'relay3', 'relay3-m2', metric('S1'))
    expect(c).toMatchObject({ verdict: '좋음', n: [3, 3], counts: true })
    expect(c.p).toBeCloseTo(0.1)
    const two = m3Compare(
      three.filter((r) => r.index < 3),
      'relay3',
      'relay3-m2',
      metric('S1'),
    )
    expect(two).toMatchObject({ verdict: '좋음', counts: false })
    // 보고만인 지표는 좋아도 들지 않는다
    expect(m3Compare(three, 'relay3', 'relay3-m2', metric('S2')).counts).toBe(false)
    const { text } = m3Report(three)
    expect(text).toMatch(
      /\| relay3 − relay3-m2 \| \*\*S1\*\* \| 3, 3 \| .* \| 좋음 \| 0\.10 \| 듦 \|/,
    )
    expect(text).toMatch(/\| relay3 − relay3-m2 \| \*\*S2\*\* \| .* \| 보고만 \|/)
  })

  it('Work 하나의 셈 더함: 말로만·허용 목록, 어느 묶음의 형식 오류, 계약 tidy의 갚음, 멀쩡한 항목', () => {
    const m = m3WorkMetrics({
      rec: { m3: { knowledge: true, debt: true, tidy: true, promote: true } },
      final: {
        knowledge: {
          changed: [],
          issues: [
            { kind: 'spoken', path: 'docs/knowledge/a.md', detail: '검사(`check:`)가 없음' },
            {
              kind: 'allow',
              path: 'docs/knowledge/b.md',
              detail:
                '검사 `no-float`의 허용 목록(`## 아직 규칙을 따르지 않는 곳`)에 `src/x.js`가 더해짐: 줄어들기만 한다',
            },
          ],
        },
        tidy: {
          taken: ['d1', 'd2'],
          items: [
            { id: 'd1', status: 'paid', detail: '항목 파일을 지움' },
            { id: 'd2', status: 'open', detail: '항목 파일이 남음' },
            { id: 'd3', status: 'open', detail: '612줄 > 600 (항목 파일을 지움)' },
            { id: 'd4', status: 'paid', detail: '항목 파일을 지움' },
          ],
          lines: 40,
          max: 30,
        },
      },
      all: [{ knowledge: { issues: [{ kind: 'format' }] } }, { knowledge: { issues: [] } }],
    })
    expect(m.knowledge).toMatchObject({ spoken: 1, allow: 1, allowChecks: ['no-float'], format: 0 })
    expect(m.issuesAny).toEqual({ format: true, allow: false })
    expect(m.tidy).toMatchObject({
      taken: 2,
      takenStatus: { paid: 1, open: 1 },
      intactDeleted: ['d3'],
    })
  })

  it('레포의 규칙 승격: kind: rule 항목의 check가 quality.json rules에 이름 그대로 있으면 승격', () => {
    const root = tmp('rules')
    write(root, {
      'docs/knowledge/a.md': '---\nkind: rule\nsource: human\ncheck: no-float\n---\n# a\n',
      'docs/knowledge/b.md': '---\nkind: rule\nsource: human\ncheck: "other"\n---\n# b\n',
      'docs/knowledge/c.md': '---\nkind: rule\nsource: human\n---\n# c\n',
      'docs/knowledge/d.md': '---\nkind: fact\ncheck: no-float\n---\n# d\n',
      '.relay/quality.json': JSON.stringify({ rules: ['no-float', 'unused'] }),
    })
    expect(repoRules(root)).toEqual({
      items: 3,
      withCheck: 2,
      promotedItems: 1,
      promoted: ['no-float'],
      rules: ['no-float', 'unused'],
    })
  })

  it('쪽의 장치 셈: 분모를 함께 내고, 승격된 검사가 뒤에 빠지거나 허용 목록이 늚을 머지하면 쓸모없음', () => {
    const aw = (m3, merged = true) => ({ merged, m3 })
    const run = withFlags(
      {
        scenario: 't',
        kind: 'relay3',
        index: 1,
        sequence: true,
        works: [
          {
            work: 1,
            cumulative: { own: { total: 1, pass: 1 }, regressed: [] },
            rules: { promoted: ['a', 'b'] },
            appWorks: [
              aw({
                issuesAny: { format: true, allow: false },
                knowledge: { format: 1, spoken: 2 },
                request: { debt: 1 },
                tidy: {
                  taken: 2,
                  takenStatus: { paid: 1, open: 1 },
                  lines: 50,
                  max: 30,
                  intactDeleted: [],
                },
              }),
            ],
          },
          {
            work: 2,
            cumulative: { own: { total: 1, pass: 0 }, regressed: [] },
            rules: { promoted: ['a', 'b', 'c'] },
            appWorks: [
              aw({
                issuesAny: { format: true, allow: true },
                knowledge: { format: 0, allow: 1, allowChecks: ['c'], spoken: 0 },
                request: { debt: 2 },
                tidy: { taken: 0, intactDeleted: ['d9'] },
                debt: { recorded: 1 },
              }),
            ],
          },
        ],
        structure: { repo: { rules: { items: 4, promotedItems: 2, promoted: ['a', 'c'] } } },
      },
      { works: 2, sealed: 0 },
    )
    const d = deviceCounts([run])
    expect(d).toMatchObject({
      appWorks: 2,
      debtRecorded: 1,
      format: { works: 2, merged: 1 },
      tidy: {
        listWorks: 2,
        listTaken: 1,
        tidyWorks: 1,
        takenIds: 2,
        paid: 1,
        overCap: 1,
        intact: 1,
        intactFailed: 1,
      },
      // a 남음, b 뒤에 빠짐, c 허용 목록이 늚을 머지: 셋 가운데 둘
      promote: {
        ruleItems: 4,
        promotedItems: 2,
        promotedEver: 3,
        useless: 2,
        allowWorks: 1,
        allowMerged: 1,
      },
    })
    expect(d.promote.spoken[0]).toBe(1)
    // Work를 다 하지 않은 줄은 세지 않는다
    expect(deviceCounts([withFlags(run, { works: 15, sealed: 0 })]).appWorks).toBe(0)
  })

  it('V35: 끝 방식마다 앱 Work 수와 자기 시험 통과, relay-v3 두 쪽을 합친 칸', () => {
    const line = (arm, how, own) =>
      withFlags(
        {
          scenario: 't',
          kind: arm,
          index: 1,
          sequence: true,
          works: [
            {
              work: 1,
              cumulative: { own: { total: 2, pass: own } },
              appWorks: [{ devices: { endReasons: { how } } }],
            },
          ],
        },
        { works: 1, sealed: 0 },
      )
    const rows = v35Rows(
      [line('relay3', 'handed', 1), line('relay3-m2', 'handed', 2), line('relay3', null, 2)],
      ['relay3', 'relay3-m2', 'cli'],
    )
    expect(rows).toEqual([
      ['-', '1 (자기 시험 통과 1)', '0 (자기 시험 통과 0)', '1 (자기 시험 통과 1)'],
      ['handed', '1 (자기 시험 통과 0)', '1 (자기 시험 통과 1)', '2 (자기 시험 통과 1)'],
    ])
  })

  it('격리 감사: 닿아도 되는 곳을 지운 뒤 세고, 도구 결과에 평가 자리가 보인 것(seen)과 github도 센다', () => {
    const cfg = tmp('audit')
    const own = '/tmp/relay-eval/m3-seq/48-long-shop-cli-1/shop'
    transcript(cfg, [
      use('t1', `cat ${own}/src/a.js`),
      use('t2', 'ls ..'),
      result('t2', 'cfg-agent\ncfg-human-3\nshop\nshop.git'),
      use('t3', 'cat ../cfg-human-3/projects/x/y.jsonl'),
      use('t4', 'cd /tmp/relay-eval/m3-seq/48-long-shop-relay3-2 && ls'),
      use('t5', 'curl https://api.github.com/user'),
    ])
    const marks = ['/tmp/relay-eval', 'cfg-human']
    expect(outsideReach(cfg, marks, { allow: [own], results: true })).toEqual({
      calls: 5,
      reach: 2,
      seen: 1,
    })
    expect(outsideReach(cfg, ['github.com']).reach).toBe(1)
    // 배치 전에 옮긴 평가 자료는 RELAY_EVAL_MARKS로 더한다
    expect(envMarks({ RELAY_EVAL_MARKS: '/home/user/m3-archive: /x/y:' })).toEqual([
      '/home/user/m3-archive',
      '/x/y',
    ])
    expect(evalMarks('/s')).toContain('eval/results')
  })

  it('Work 에이전트의 격리 감사는 Work마다 그 Work의 몫을 적는다(사람 역할 설정 폴더, 다른 줄)', async () => {
    const { dir, scenario } = tinyScenario()
    const o = job(dir, scenario)
    const p = jobPaths(o)
    const first = await runJob({ ...o, until: 1 })
    expect(first.works[0].outside).toEqual({ calls: 0, reach: 0, seen: 0, github: 0 })
    // Work 2의 에이전트: 자기 레포 안 하나, 사람 역할의 설정 폴더를 읽음 하나, 다른 줄의 작업 폴더 하나
    transcript(path.join(p.workDir, 'cfg-agent'), [
      use('a1', `cat ${path.join(p.repo, 'src/calc.js')}`),
      use('a2', `cat ${path.join(p.workDir, 'cfg-human-2', 'x.jsonl')}`),
      use('a3', `ls ${path.join(o.workRoot, 't-tiny-relay3-1')}`),
      use('a4', 'ls ..'),
      result('a4', 'cfg-agent\ncfg-human-2\ncalc'),
    ])
    const r = await runJob({ ...o, until: 2 })
    expect(r.works[1].outside).toEqual({ calls: 4, reach: 2, seen: 1, github: 0 })
    expect(r.works[0].outside.calls).toBe(0)
    const a = workAudit(p, o)
    expect(a.allow).toContain(p.repo)
    expect(a.marks).toContain(path.resolve(o.outDir))
    // 규칙 승격은 Work마다 main에서 센다(이 레포에는 규칙 항목이 없다)
    expect(r.works[1].rules).toMatchObject({ items: 0, promoted: [] })
  })

  it('걸음 하나의 시도는 이어 돌기를 넘어 상한까지만 하고, 시도마다 까닭(도구 문제, 끊김)을 남긴다', async () => {
    const { dir, scenario } = tinyScenario()
    const seen = []
    const o = job(dir, scenario, { maxAttempts: 2 })
    const p = jobPaths(o)
    // Work 2에서 끊긴 것처럼: Work 1까지 하고 state에 끊긴 걸음을 적는다
    await runJob({ ...o, until: 1 })
    const stateFile = path.join(p.resultDir, 'state.json')
    const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    st.inProgress = { kind: 'work', n: 1 }
    st.attempts['work-02'] = 1
    fs.writeFileSync(stateFile, JSON.stringify(st))
    await runJob({ ...o, until: 2 })
    // 봉인 과제: 두 번 도구 문제로 멈추면 상한(2)을 다 써서 세 번째는 돌지 않는다
    const bad = fakeBaseline(dir, seen, 'error')
    await expect(runJob({ ...o, sealedAgent: bad })).rejects.toThrow(/봉인 과제/)
    await expect(runJob({ ...o, sealedAgent: bad })).rejects.toThrow(/봉인 과제/)
    const third = runJob({ ...o, sealedAgent: fakeBaseline(dir, seen) })
    await expect(third).rejects.toMatchObject({ exhausted: true })
    expect(seen).toHaveLength(2)
    const done = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    expect(done.attempts).toMatchObject({ 'work-02': 2, 'sealed-s1': 2 })
    expect(done.failures['work-02']).toEqual([{ attempt: 1, cause: 'restart', error: null }])
    expect(done.failures['sealed-s1'].map((x) => [x.attempt, x.cause])).toEqual([
      [1, 'tool_error'],
      [2, 'tool_error'],
    ])
    const flags = withFlags(composeRun(p.resultDir, done, 3, [{ id: 's1' }]))
    expect(flags.retryCauses).toEqual({ restart: 1, tool_error: 2 })
  })

  it('봉인 과제의 시간 초과는 레포가 시험을 통과해도 실패다', async () => {
    const { dir, scenario } = tinyScenario()
    const slow = async ({ cwd }) => {
      execFileSync('git', ['apply', path.join(dir, 'sealed/reference-s1.patch')], { cwd })
      return { ending: 'timeout', ms: 60_000, costUsd: null, result: null, error: null }
    }
    const r = await runJob(job(dir, scenario, { sealedAgent: slow }))
    expect(r.sealed[0]).toMatchObject({ ending: 'timeout', pass: false, own: { pass: 1 } })
    expect(r.sealed[0].uncommitted).toBeGreaterThan(0)
  })

  it('끝내지 못한 줄을 새 회차로: 첫 회차 번호를 준다', () => {
    expect(sequenceJobs(['relay3', 'cli'], 2)).toEqual([
      { arm: 'relay3', index: 1 },
      { arm: 'cli', index: 1 },
      { arm: 'relay3', index: 2 },
      { arm: 'cli', index: 2 },
    ])
    expect(sequenceJobs(['relay3'], 1, 4)).toEqual([{ arm: 'relay3', index: 4 }])
  })

  it('에이전트 프로젝트 메모리: 작업 폴더 키마다 memory 아래 파일', () => {
    const cfg = tmp('memory')
    write(cfg, {
      'projects/-tmp-a-shop/memory/MEMORY.md': 'x',
      'projects/-tmp-a-shop/s.jsonl': '',
      'projects/-tmp-wt-1/s.jsonl': '',
      'projects/-tmp-wt-2/memory/.keep/n.md': 'y',
    })
    expect(agentMemory(cfg)).toEqual({ projects: 3, withMemory: 2, files: 2 })
    expect(agentMemory(tmp('none'))).toEqual({ projects: 0, withMemory: 0, files: 0 })
  })
})
