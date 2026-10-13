// 평가 도구의 측정 로직 (docs/eval.md 6절). 모델을 부르지 않는다. 측정이 틀리면 평가의 결론이 뒤집히므로
// (eval-findings E1: 맨 CLI의 흩어진 브랜치를 놓쳐 통과율을 40%로 적음) 판정과 집계를 여기서 지킨다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CliArm } from '../lib/cli-arm.mjs'
import {
  codeOutcome,
  dropBranch,
  exportCommit,
  judgeTree,
  makeRepo,
  mergeInPlace,
  openRepo,
  withoutKnowledge,
} from '../lib/repo.mjs'
import { resumeState } from '../lib/episode.mjs'
import { agentUsage, agentUsageBySession, git, questionsBySession, stats } from '../lib/util.mjs'
import { chained, measuredWorks, pairOf, workParts, workScenario } from '../lib/works.mjs'
import { compare } from '../primary.mjs'
import { finalKnowledge, kindOf, knowledgeInDiff } from '../knowledge-quality.mjs'

const dirs = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-eval-test-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

const write = (root, files) => {
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.writeFileSync(path.join(root, f), text)
  }
}

/** 버그 하나(add가 뺄셈)와 통과하는 레포 시험이 있는 기준 레포, 버그를 잡는 숨긴 시험 */
function scenarioDirs() {
  const root = tmp()
  const base = path.join(root, 'scenario/repo')
  const hidden = path.join(root, 'scenario/hidden')
  write(base, {
    'package.json': JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }),
    'src/add.js': 'export const add = (a, b) => a - b\n',
    'src/other.js': 'export const other = 1\n',
    'test/ok.test.js':
      "import { test } from 'node:test'\nimport assert from 'node:assert'\ntest('ok', () => assert.ok(true))\n",
  })
  write(hidden, {
    'add.test.js':
      "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { add } from '../src/add.js'\ntest('add', () => assert.strictEqual(add(2, 3), 5))\n",
  })
  return { root, base, hidden }
}

describe('맨 CLI의 결과 폴더 (E1)', () => {
  function cliRepo() {
    const { root, base } = scenarioDirs()
    const r = makeRepo(path.join(root, 'work'), 'repo', base)
    return { ...r, root }
  }
  const commit = (repo, file, text, msg) => {
    fs.writeFileSync(path.join(repo, file), text)
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', msg)
  }

  it('체크아웃되지 않은 브랜치의 커밋도 결과 폴더로 꺼낸다', () => {
    const { repo, base, root } = cliRepo()
    git(repo, 'checkout', '-q', '-b', 'fix-a')
    commit(repo, 'src/add.js', 'export const add = (a, b) => a + b\n', 'fix a')
    git(repo, 'checkout', '-q', 'main')
    git(repo, 'checkout', '-q', '-b', 'fix-b')
    commit(repo, 'src/other.js', 'export const other = 2\n', 'fix b')

    const arm = new CliArm({ dir: path.join(root, 'arm'), repo, base })
    const trees = arm.finalTrees()
    expect(trees.map((t) => t.label)).toEqual(['repo', 'branch-fix-a'])
    const a = trees[1]
    expect(a.git).toMatchObject({ branch: 'fix-a', commits: 1, log: ['fix a'] })
    expect(fs.readFileSync(path.join(a.path, 'src/add.js'), 'utf8')).toContain('a + b')
    expect(trees[0].git).toMatchObject({ branch: 'fix-b', commits: 1 })
  })

  it('HEAD에 이미 들어 있거나 기준 뒤 커밋이 없는 브랜치는 꺼내지 않는다', () => {
    const { repo, base, root } = cliRepo()
    git(repo, 'branch', 'empty')
    git(repo, 'checkout', '-q', '-b', 'merged')
    commit(repo, 'src/add.js', 'export const add = (a, b) => a + b\n', 'fix')
    git(repo, 'checkout', '-q', 'main')
    git(repo, 'merge', '-q', '--ff-only', 'merged')

    const trees = new CliArm({ dir: path.join(root, 'arm'), repo, base }).finalTrees()
    expect(trees.map((t) => t.label)).toEqual(['repo'])
  })
})

describe('결과 판정', () => {
  it('숨긴 시험, 레포 시험, 기대 밖 파일을 가르고 지식 파일은 코드 결과에서 뺀다', () => {
    const { root, base, hidden } = scenarioDirs()
    const tree = path.join(root, 'tree')
    fs.cpSync(base, tree, { recursive: true })
    write(tree, {
      'src/add.js': 'export const add = (a, b) => a + b\n',
      'README.md': '고침\n',
      'docs/knowledge/vat.md': '---\nkind: rule\n---\n부가세는 줄마다 버린다\n',
    })
    const scenario = {
      expectedFiles: ['src/**'],
      checks: [{ name: '더하기', file: 'add.test.js', bug: 'add' }],
    }
    const r = judgeTree({ tree, baseDir: base, hiddenDir: hidden, scenario, work: tmp() })
    expect(r.checks).toMatchObject([{ name: '더하기', bug: 'add', pass: true }])
    expect(r.repoTests.pass).toBe(true)
    expect(r.files.map((f) => f.file).sort()).toEqual(['README.md', 'src/add.js'])
    expect(r.unrelated).toEqual(['README.md'])
    expect(r.knowledgeFiles).toEqual(['docs/knowledge/vat.md'])
    // 저장하는 diff에는 지식이 남고, 판정 모델에 보일 diff에서는 빠진다
    expect(r.diff).toContain('docs/knowledge/vat.md')
    expect(withoutKnowledge(r.diff)).not.toContain('docs/knowledge/vat.md')
    expect(withoutKnowledge(r.diff)).toContain('src/add.js')
  })

  it('copyIgnore의 빌드 산출물은 차이와 범위에서 빼고 repoTest로 레포 시험 명령을 바꾼다', () => {
    const { root, base, hidden } = scenarioDirs()
    const tree = path.join(root, 'tree')
    fs.cpSync(base, tree, { recursive: true })
    write(tree, { 'src/add.js': 'export const add = (a, b) => a + b\n', 'host/build/x.o': 'bin' })
    write(base, { Makefile: 'test:\n\t@node --test test\n' })
    write(tree, { Makefile: 'test:\n\t@node --test test\n' })
    const scenario = {
      expectedFiles: ['src/**'],
      copyIgnore: ['host/build'],
      repoTest: ['make', '-s', 'test'],
      checks: [{ name: '더하기', file: 'add.test.js' }],
    }
    const r = judgeTree({ tree, baseDir: base, hiddenDir: hidden, scenario, work: tmp() })
    expect(r.files.map((f) => f.file)).toEqual(['src/add.js'])
    expect(r.unrelated).toEqual([])
    expect(r.repoTests.pass).toBe(true)
    expect(r.checks[0].pass).toBe(true)
    const bad = judgeTree({
      tree,
      baseDir: base,
      hiddenDir: hidden,
      scenario: { ...scenario, repoTest: ['false'] },
      work: tmp(),
    })
    expect(bad.repoTests.pass).toBe(false)
    const skipped = judgeTree({
      tree,
      baseDir: base,
      hiddenDir: hidden,
      scenario,
      work: tmp(),
      skipTests: true,
    })
    expect(skipped.checks).toEqual([])
    expect(skipped.repoTests.pass).toBe(null)
    expect(skipped.files.map((f) => f.file)).toEqual(['src/add.js'])
  })

  it('고치지 않은 기준은 숨긴 시험이 실패한다', () => {
    const { base, hidden } = scenarioDirs()
    const scenario = { expectedFiles: [], checks: [{ name: '더하기', file: 'add.test.js' }] }
    const r = judgeTree({ tree: base, baseDir: base, hiddenDir: hidden, scenario, work: tmp() })
    expect(r.checks[0].pass).toBe(false)
    expect(r.files).toEqual([])
  })

  it('지식 파일을 따로 두기 전의 결과도 지식을 빼고 읽는다', () => {
    const old = {
      filesChanged: ['src/a.js', 'docs/knowledge/x.md'],
      unrelated: ['docs/knowledge/x.md'],
      trees: [
        {
          files: [
            { file: 'src/a.js', add: 2, del: 1 },
            { file: 'docs/knowledge/x.md', add: 9, del: 0 },
          ],
        },
      ],
    }
    expect(codeOutcome(old)).toEqual({
      filesChanged: ['src/a.js'],
      linesChanged: 3,
      unrelated: [],
      knowledgeFiles: ['docs/knowledge/x.md'],
    })
  })
})

describe('에이전트 대화 기록 집계', () => {
  const line = (o) => JSON.stringify(o) + '\n'
  function configDir() {
    const dir = tmp()
    const project = path.join(dir, 'projects/-repo')
    // 같은 메시지 id의 앞 줄은 출력 토큰을 다 세지 않은 값이다. 마지막 줄만 센다
    write(project, {
      's1.jsonl':
        line({ message: { id: 'm1', usage: { input_tokens: 10, output_tokens: 1 } } }) +
        line({ message: { id: 'm1', usage: { input_tokens: 10, output_tokens: 7 } } }) +
        line({
          message: {
            id: 'm2',
            usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 100 },
            content: [{ type: 'tool_use', id: 'q1', name: 'AskUserQuestion', input: {} }],
          },
        }) +
        line({
          message: { content: [{ type: 'tool_use', id: 'q1', name: 'AskUserQuestion' }] },
        }) +
        '{"message": {"usage": 쓰는 중',
      // 서브에이전트 기록은 그 세션에 넣는다
      's1/subagents/a.jsonl': line({
        message: { id: 'm3', usage: { input_tokens: 1, output_tokens: 1 } },
      }),
      's2.jsonl': '',
    })
    return dir
  }

  it('메시지 id마다 마지막 줄의 사용량을 세션마다 더한다', () => {
    const by = agentUsageBySession(configDir())
    expect(by.get('s1')).toEqual({
      input: 16,
      output: 10,
      cacheRead: 100,
      cacheWrite: 0,
      messages: 3,
    })
    expect(by.get('s2')).toMatchObject({ input: 0, messages: 0 })
  })

  it('전체 합계는 세션별 합과 같고 sessions는 기록 파일 수다', () => {
    expect(agentUsage(configDir())).toEqual({
      input: 16,
      output: 10,
      cacheRead: 100,
      cacheWrite: 0,
      messages: 3,
      sessions: 3,
    })
  })

  it('질문은 같은 호출 id를 한 번 센다', () => {
    const q = questionsBySession(configDir())
    expect(q.get('s1')).toBe(1)
    expect(q.get('s2')).toBe(0)
  })
})

describe('이어 돌리기 (run.mjs --resume)', () => {
  it('끝낸 Work의 결과와 차례를 읽고 끊긴 Work의 차례는 지운다', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'))
    const turn = (n, work, actions, t) => ({ turn: n, work, t, actions })
    const lines = [
      { event: 'work', t: 1, text: 'Work 1' },
      turn(
        1,
        1,
        [
          { do: 'fill', text: '요청 글', ok: true },
          { do: 'click', ok: true },
        ],
        10,
      ),
      turn(
        2,
        1,
        [
          { do: 'click', ok: false },
          { do: 'done', refused: true },
        ],
        20,
      ),
      { event: 'work', t: 30, text: 'Work 2' },
      turn(3, 2, [{ do: 'wait' }, { do: 'done' }], 40),
      { event: 'work', t: 50, text: 'Work 3' },
      turn(4, 3, [{ do: 'type', text: '끊긴 Work', ok: true }], 60),
    ]
    fs.writeFileSync(
      path.join(out, 'turns.jsonl'),
      lines.map((l) => `${JSON.stringify(l)}\n`).join(''),
    )
    expect(resumeState(out)).toBeNull()
    fs.writeFileSync(
      path.join(out, 'progress.json'),
      JSON.stringify({
        workResults: [
          { work: 1, relayWorks: ['w-1'] },
          { work: 2, relayWorks: ['w-2', 'w-3'] },
        ],
        handoffs: [{ work: 2, inPlace: true }],
      }),
    )
    const r = resumeState(out)
    expect(r.workResults.map((x) => x.work)).toEqual([1, 2])
    expect(r.handoffs).toEqual([{ work: 2, inPlace: true }])
    expect(r.turns.map((t) => t.turn)).toEqual([1, 2, 3])
    expect(r.counts).toEqual({ fill: 1, click: 2, wait: 1, done: 1 })
    expect(r.charsTyped).toBe('요청 글'.length)
    expect(r.invalid).toBe(1)
    expect(r.refusedDone).toBe(1)
    expect(r.lastT).toBe(40)
    expect([...r.keepWorks]).toEqual(['w-1', 'w-2', 'w-3'])
    // 끊긴 Work 3의 차례는 파일에서도 지운다
    const kept = fs.readFileSync(path.join(out, 'turns.jsonl'), 'utf8').trim().split('\n')
    expect(kept).toHaveLength(5)
    // 옛 progress.json(relayWorks 없음)은 끝낸 relay Work를 모른다
    fs.writeFileSync(
      path.join(out, 'progress.json'),
      JSON.stringify({ workResults: [{ work: 1 }] }),
    )
    expect(resumeState(out).keepWorks).toBeNull()
    fs.rmSync(out, { recursive: true, force: true })
  })

  it('레포를 다시 열고, 끊긴 Work의 브랜치와 worktree를 지운다', () => {
    const { root, base } = scenarioDirs()
    const r = makeRepo(path.join(root, 'work'), 'repo', base)
    const wt = path.join(root, 'wt')
    git(r.repo, 'worktree', 'add', '-q', '-b', 'relay/w-2', wt)
    fs.writeFileSync(path.join(wt, 'half.txt'), '하다 만 것\n')
    git(wt, 'add', '-A')
    git(wt, 'commit', '-q', '-m', 'half')
    git(r.repo, 'branch', 'relay/w-1')
    git(r.repo, 'commit', '-q', '--allow-empty', '-m', 'merged')
    const o = openRepo(path.join(root, 'work'), 'repo')
    expect(o).toEqual({ repo: r.repo, remote: r.remote, base: r.base })
    dropBranch(o.repo, 'relay/w-2')
    expect(fs.existsSync(wt)).toBe(false)
    expect(git(o.repo, 'branch', '--list', 'relay/*')).toBe('relay/w-1')
    // 없는 브랜치는 그냥 지나간다
    dropBranch(o.repo, 'relay/w-9')
    expect(() => openRepo(path.join(root, 'work'), 'none')).toThrow(/이어 돌릴 레포가 없음/)
  })
})

describe('이어 머지 (docs/eval-ssd.md)', () => {
  function repoWithWork() {
    const { root, base } = scenarioDirs()
    const r = makeRepo(path.join(root, 'work'), 'repo', base)
    git(r.repo, 'checkout', '-q', '-b', 'relay/w1')
    fs.writeFileSync(path.join(r.repo, 'src/add.js'), 'export const add = (a, b) => a + b\n')
    git(r.repo, 'commit', '-q', '-am', 'fix')
    return { ...r, root }
  }

  it('앞 Work 브랜치를 main에 머지하고 원격과 작업 폴더의 main을 옮긴다', () => {
    const { root, repo, remote, base } = repoWithWork()
    git(repo, 'checkout', '-q', 'main')
    const m = mergeInPlace(repo, remote, path.join(root, 'scratch'))
    expect(m.merged).toEqual(['relay/w1'])
    expect(m.dirty).toBe(false)
    expect(git(repo, 'rev-parse', 'main')).toBe(m.head)
    expect(git(remote, 'rev-parse', 'main')).toBe(m.head)
    expect(fs.readFileSync(path.join(repo, 'src/add.js'), 'utf8')).toContain('a + b')
    expect(git(repo, 'merge-base', '--is-ancestor', base, 'main')).toBe('')
    // 다시 머지하면 새로 머지할 것이 없다
    expect(mergeInPlace(repo, remote, path.join(root, 'scratch')).merged).toEqual([])
    // 그 main을 폴더로 꺼내 다음 Work의 기준으로 쓴다
    const dest = exportCommit(repo, m.head, path.join(root, 'base-2'))
    expect(fs.readFileSync(path.join(dest, 'src/add.js'), 'utf8')).toContain('a + b')
    expect(fs.existsSync(path.join(dest, '.git'))).toBe(false)
  })

  it('다른 브랜치에 깨끗하면 main을 체크아웃하고, main에 커밋 안 된 변경이 있으면 작업 폴더는 그대로 둔다', () => {
    const a = repoWithWork()
    mergeInPlace(a.repo, a.remote, path.join(a.root, 'scratch'))
    expect(git(a.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')

    const b = repoWithWork()
    git(b.repo, 'checkout', '-q', 'main')
    fs.writeFileSync(path.join(b.repo, 'src/other.js'), 'export const other = 9\n')
    const m = mergeInPlace(b.repo, b.remote, path.join(b.root, 'scratch'))
    expect(m.dirty).toBe(true)
    expect(fs.readFileSync(path.join(b.repo, 'src/add.js'), 'utf8')).toContain('a - b')
    expect(git(b.remote, 'rev-parse', 'main')).toBe(m.head)
  })

  it('Work의 유형·기대 파일·제한은 Work의 값이 시나리오의 값을 덮는다', () => {
    const s = {
      type: 'feature',
      expectedFiles: ['src/**'],
      limits: { minutes: 40 },
      works: [
        { report: 'd', type: 'spec', expectedFiles: ['docs/**'], limits: { minutes: 30 } },
        { report: 'f', merge: true },
      ],
    }
    expect(chained(s)).toBe(true)
    expect(chained({ works: [{ report: 'a' }, { report: 'b', teammate: true }] })).toBe(false)
    expect(workScenario(s, 0)).toMatchObject({
      type: 'spec',
      expectedFiles: ['docs/**'],
      limits: { minutes: 30 },
    })
    const w2 = workScenario(s, 1)
    expect(w2).toMatchObject({
      type: 'feature',
      expectedFiles: ['src/**'],
      limits: { minutes: 40 },
    })
    expect(w2.work).toMatchObject({ index: 1, merge: true })
  })
})

describe('Work 여럿을 잇는 시나리오', () => {
  const multi = {
    id: 'x',
    report: '무시',
    works: [
      { report: 'w1', checks: [{ name: 'a' }] },
      { report: 'w2', checks: [{ name: 'b' }], teammate: true },
      { report: 'w3', checks: [{ name: 'c' }] },
    ],
  }

  it('works가 없으면 시나리오 자신이 Work 하나이고 짝은 relay 대 맨 CLI다', () => {
    const one = { report: 'r', knowledge: [], checks: [] }
    expect(workParts(one)).toHaveLength(1)
    expect(measuredWorks(one)).toEqual([0])
    expect(pairOf(one)).toEqual(['relay', 'cli'])
  })

  it('재는 Work는 기본이 첫 Work를 뺀 모두이고 measure로 바꾼다', () => {
    expect(measuredWorks(multi)).toEqual([1, 2])
    expect(measuredWorks({ ...multi, measure: [3, 9] })).toEqual([2])
    expect(pairOf(multi)).toEqual(['relay', 'relay-off'])
  })

  it('n번째 Work만 담은 시나리오는 팀원 교대에서 사람이 바뀐 수를 센다', () => {
    const w = workScenario(multi, 2)
    expect(w.report).toBe('w3')
    expect(w.works).toBeUndefined()
    expect(w.work).toEqual({ index: 2, count: 3, teammate: false, merge: false, mates: 1 })
    expect(() => workScenario(multi, 5)).toThrow()
  })
})

describe('통계와 지식', () => {
  it('stats는 수가 아닌 값을 빼고 표본 표준편차를 낸다', () => {
    expect(stats([1, 2, 3, null, NaN])).toEqual({ n: 3, mean: 2, sd: 1 })
    expect(stats([])).toEqual({ n: 0, mean: null, sd: null })
  })

  it('compare는 시나리오마다 같은 무게로 차이를 내고 씨앗이 같으면 구간도 같다', () => {
    const groups = [
      { a: [1, 1, 1], b: [0, 0, 0] },
      { a: [3, 3], b: [0, 0] },
      { a: [], b: [5] },
    ]
    const r = compare(groups, 2000)
    expect(r).toMatchObject({ diff: 2, lo: 2, hi: 2, scenarios: 2 })
    const noisy = [{ a: [0, 1, 0, 1], b: [0, 0, 1, 0] }]
    expect(compare(noisy, 2000)).toEqual(compare(noisy, 2000))
    expect(compare([{ a: [], b: [1] }])).toBeNull()
  })

  it('knowledgeInDiff는 새 지식 파일의 내용과 지운 파일을 읽고 README는 뺀다', () => {
    const diff = [
      'diff --git a/base/docs/knowledge/vat.md b/tree/docs/knowledge/vat.md',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/tree/docs/knowledge/vat.md',
      '@@ -0,0 +1,2 @@',
      '+---',
      '+kind: rule',
      'diff --git a/base/docs/knowledge/README.md b/tree/docs/knowledge/README.md',
      '--- /dev/null',
      '@@ -0,0 +1 @@',
      '+읽어 보기',
      'diff --git a/base/docs/knowledge/old.md b/base/docs/knowledge/old.md',
      'deleted file mode 100644',
      '',
    ].join('\n')
    const k = knowledgeInDiff(diff)
    expect([...k.keys()].sort()).toEqual(['docs/knowledge/old.md', 'docs/knowledge/vat.md'])
    expect(k.get('docs/knowledge/vat.md')).toBe('---\nkind: rule\n')
    expect(k.get('docs/knowledge/old.md')).toBeNull()
  })

  it('finalKnowledge는 이어 머지 Work의 diff를 레포 전체로 본다(앞 Work에서 지운 지식이 남지 않음)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kq-'))
    const file = (name, text) =>
      [
        `diff --git a/base/docs/knowledge/${name} b/tree/docs/knowledge/${name}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/tree/docs/knowledge/${name}`,
        '@@ -0,0 +1 @@',
        `+${text}`,
      ].join('\n')
    fs.mkdirSync(path.join(dir, 'final'))
    fs.writeFileSync(
      path.join(dir, 'final', 'w1.diff'),
      `${file('a.md', '하나')}\n${file('b.md', '둘')}\n`,
    )
    fs.writeFileSync(path.join(dir, 'final', 'w2.diff'), `${file('a.md', '하나 고침')}\n`)
    const run = { dir, works: [{ id: 'w1' }, { id: 'w2' }] }
    const merged = finalKnowledge(run, { works: [{}, { merge: true }] })
    expect(merged).toEqual([{ path: 'docs/knowledge/a.md', text: '하나 고침\n' }])
    // 같은 사람이 main에서 따로 시작하는 Work는 앞 Work의 지식 위에 덮는다
    const same = finalKnowledge(run, { works: [{}, {}] })
    expect(same.map((k) => k.path)).toEqual(['docs/knowledge/a.md', 'docs/knowledge/b.md'])
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('kindOf는 머리글의 kind를 정한 값으로만 읽는다', () => {
    expect(kindOf('---\nkind: pitfall\n---\n본문')).toBe('pitfall')
    expect(kindOf('---\nkind: 규칙\n---\n')).toBe('기타')
    expect(kindOf('머리글 없음')).toBe('없음')
  })
})
