// 장기 평가(sequence)를 돌리는 길: 걸음의 차례와 이어 돌기, 사람 역할의 기억(다시 말하기 PM1), 누적 숨긴 시험, 기준 브랜치에
// 넣기, 구조 지표, M3 장치 지표, 집계(m3-primary.mjs) (docs/eval.md 5절 '장기 평가 돌리기', relay-v3 docs/m3-design.md 6절).
// 모델을 부르지 않는다. 이어 돌기는 건식(정답 패치)으로 작은 열을 실제 git과 체크포인트로 돈다. 시나리오 48의 봉인 파일은
// 읽지 않는다(여기 열은 시험이 지어낸 것이다).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { changedFixed } from '../run-sequence.mjs'
import {
  m3Compare,
  m3Report,
  M3_METRICS,
  perWorkRows,
  retellsOf,
  withFlags,
} from '../m3-primary.mjs'
import { endCriterion, sequenceGuide, systemPrompt } from '../lib/human.mjs'
import {
  ledgerMetrics,
  m3WorkMetrics,
  parseLedger,
  repoM3,
  requestSections,
} from '../lib/m3-metrics.mjs'
import { endReasons } from '../lib/relay3-devices.mjs'
import { prepareMerge, relay3FakeGh } from '../lib/fake-gh.mjs'
import { RELAY3_APP, relay3AppOf } from '../lib/relay3-arm.mjs'
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
import { composeRun, jobPaths, landRelay3, runJob } from '../lib/sequence-run.mjs'
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
    expect(text).toContain('| relay3#2 | 2 | 2/3 (s1 O, s2 O, s3 X) | 8/10 | 1 | work-01 |')
    expect(text).toContain('| relay3 − relay3-m2 | **S1** |')
    expect(comparisons['relay3:relay3-m2:S1'].reading).toBe('다름')
    expect(perWorkRows(runs, ['relay3', 'cli'])[1]).toEqual(['2', '0.90 (n 2; app 2)', '-'])
  })
})
