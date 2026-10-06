// 평가 도구의 측정 로직 (docs/eval.md 6절). 모델을 부르지 않는다. 측정이 틀리면 평가의 결론이 뒤집히므로
// (eval-findings E1: 맨 CLI의 흩어진 브랜치를 놓쳐 통과율을 40%로 적음) 판정과 집계를 여기서 지킨다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CliArm } from '../lib/cli-arm.mjs'
import { codeOutcome, judgeTree, makeRepo, withoutKnowledge } from '../lib/repo.mjs'
import { agentUsage, agentUsageBySession, git, questionsBySession, stats } from '../lib/util.mjs'
import { measuredWorks, pairOf, workParts, workScenario } from '../lib/works.mjs'
import { compare } from '../primary.mjs'
import { kindOf, knowledgeInDiff } from '../knowledge-quality.mjs'

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
    expect(w.work).toEqual({ index: 2, count: 3, teammate: false, mates: 1 })
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

  it('kindOf는 머리글의 kind를 정한 값으로만 읽는다', () => {
    expect(kindOf('---\nkind: pitfall\n---\n본문')).toBe('pitfall')
    expect(kindOf('---\nkind: 규칙\n---\n')).toBe('기타')
    expect(kindOf('머리글 없음')).toBe('없음')
  })
})
