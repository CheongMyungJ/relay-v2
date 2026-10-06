// 설계 시나리오의 판정 (relay I111). 숨긴 쟁점은 판정 모델이 가르므로 모델에 줄 입력(대화 기록, 문서 diff, 쟁점 목록)의
// 조립과 결과를 checks로 읽는 규칙, 범위 guard의 계산을 여기서 지킨다. 모델은 부르지 않는다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { shapeProblems } from '../check-scenario.mjs'
import { combineChecks } from '../lib/episode.mjs'
import {
  dialogueFromTranscript,
  isIssue,
  issueChecks,
  issuePrompt,
  readDialogue,
} from '../lib/issue-judge.mjs'
import { outcomeCriteria } from '../lib/judge.mjs'
import { words } from '../lib/kind.mjs'
import { judgeTree } from '../lib/repo.mjs'

const dirs = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-eval-issue-'))
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

const ISSUES = [
  { name: '방해 금지 시간대', issue: '방해 금지 시간은 사용자 시간대 기준이다' },
  { name: '결제 서술', issue: '결제는 큐로 처리된다고 적는다', ask: false },
]

/** 세션 기록 한 파일: 에이전트의 글과 질문, 사람의 입력과 답, 서브에이전트와 메타 줄, 질문이 아닌 도구 결과 */
const TRANSCRIPT = [
  {
    type: 'user',
    timestamp: '2026-10-06T01:00:00Z',
    message: { content: '알림 설정을 설계해 줘' },
  },
  {
    type: 'user',
    isMeta: true,
    timestamp: '2026-10-06T01:00:01Z',
    message: { content: '<command-name>/relay-spec</command-name>' },
  },
  {
    type: 'assistant',
    timestamp: '2026-10-06T01:00:02Z',
    message: {
      content: [
        { type: 'text', text: '주제 1은 방해 금지 시간입니다.' },
        { type: 'tool_use', id: 'r1', name: 'Read', input: { file_path: 'src/a.js' } },
        {
          type: 'tool_use',
          id: 'q1',
          name: 'AskUserQuestion',
          input: {
            questions: [
              {
                question: '방해 금지 시간의 기준은?',
                options: [{ label: '서버 시간 (추천)' }, { label: '사용자 시간대' }],
              },
            ],
          },
        },
      ],
    },
  },
  {
    type: 'user',
    timestamp: '2026-10-06T01:00:03Z',
    message: {
      content: [
        { type: 'tool_result', tool_use_id: 'r1', content: '파일 내용' },
        {
          type: 'tool_result',
          tool_use_id: 'q1',
          content: [{ type: 'text', text: '"방해 금지 시간의 기준은?"="사용자 시간대"' }],
        },
      ],
    },
  },
  {
    type: 'assistant',
    isSidechain: true,
    timestamp: '2026-10-06T01:00:04Z',
    message: { content: [{ type: 'text', text: '서브에이전트의 글' }] },
  },
  // 같은 호출이 두 줄에 나뉘어 적혀도 한 번만 센다
  {
    type: 'assistant',
    timestamp: '2026-10-06T01:00:05Z',
    message: { content: [{ type: 'tool_use', id: 'q1', name: 'AskUserQuestion', input: {} }] },
  },
]

describe('대화 기록 (I111)', () => {
  it('에이전트의 글과 질문(선택지 포함), 사람의 입력과 답을 차례로 뽑고 서브에이전트·메타·다른 도구 결과는 뺀다', () => {
    expect(
      dialogueFromTranscript(TRANSCRIPT).map(({ who, kind, text }) => [who, kind, text]),
    ).toEqual([
      ['human', 'text', '알림 설정을 설계해 줘'],
      ['agent', 'text', '주제 1은 방해 금지 시간입니다.'],
      ['agent', 'question', '방해 금지 시간의 기준은? [선택지: 서버 시간 (추천) / 사용자 시간대]'],
      ['human', 'answer', '"방해 금지 시간의 기준은?"="사용자 시간대"'],
    ])
  })

  it('설정 폴더의 모든 세션 기록을 시각 차례로 모으고 서브에이전트 폴더와 쓰는 중인 줄은 뺀다', () => {
    const dir = tmp()
    const line = (o) => JSON.stringify(o) + '\n'
    write(path.join(dir, 'projects/-repo'), {
      'b.jsonl': line({
        type: 'user',
        timestamp: '2026-10-06T02:00:00Z',
        message: { content: '둘째 task' },
      }),
      'a.jsonl':
        line({ type: 'user', timestamp: '2026-10-06T01:00:00Z', message: { content: '첫 task' } }) +
        '{"type": "user", 쓰는 중',
      'a/subagents/x.jsonl': line({
        type: 'user',
        timestamp: '2026-10-06T01:30:00Z',
        message: { content: '서브에이전트' },
      }),
    })
    expect(readDialogue(dir).map((d) => d.text)).toEqual(['첫 task', '둘째 task'])
    expect(readDialogue(path.join(dir, 'none'))).toEqual([])
  })
})

describe('판정 모델의 입력 (I111)', () => {
  it('쟁점에 번호를 붙이고 문서 diff와 누가 말했는지 붙인 대화를 넣는다', () => {
    const prompt = issuePrompt({
      issues: ISSUES,
      diff: '+## 방해 금지\n+사용자 시간대 기준',
      dialogue: dialogueFromTranscript(TRANSCRIPT),
    })
    expect(prompt).toContain('1. 방해 금지 시간대 — 방해 금지 시간은 사용자 시간대 기준이다')
    expect(prompt).toContain('2. 결제 서술 — 결제는 큐로 처리된다고 적는다')
    expect(prompt).toContain('+사용자 시간대 기준')
    expect(prompt).toContain('[에이전트 (질문)] 방해 금지 시간의 기준은?')
    expect(prompt).toContain('[사람 (답)] "방해 금지 시간의 기준은?"="사용자 시간대"')
    expect(prompt).toContain('[사람] 알림 설정을 설계해 줘')
  })

  it('변경과 대화가 없으면 없다고 적고, 긴 대화는 앞을 잘라 뒤를 남긴다', () => {
    const empty = issuePrompt({ issues: ISSUES, diff: '', dialogue: [] })
    expect(empty).toContain('(변경 없음)')
    expect(empty).toContain('(없음)')
    const long = Array.from({ length: 60 }, (_, i) => ({
      who: 'agent',
      kind: 'text',
      text: `${i}번 `.padEnd(1000, '가'),
    }))
    const p = issuePrompt({ issues: ISSUES, diff: 'x', dialogue: long })
    expect(p).toContain('(앞부분 생략)')
    expect(p).toContain('59번')
    expect(p).not.toContain('[에이전트] 0번')
  })
})

describe('판정 결과 읽기 (I111)', () => {
  it('물었고 반영됐으면 통과다. ask: false인 쟁점은 반영만 본다', () => {
    const checks = issueChecks(ISSUES, {
      results: [
        { n: 1, asked: true, reflected: true, evidence: '사용자 시간대로 적음' },
        { n: 2, asked: false, reflected: true, evidence: '큐로 적음' },
      ],
    })
    expect(checks).toEqual([
      {
        name: '방해 금지 시간대',
        issue: true,
        pass: true,
        asked: true,
        reflected: true,
        output: '사용자 시간대로 적음',
      },
      {
        name: '결제 서술',
        issue: true,
        pass: true,
        asked: false,
        reflected: true,
        output: '큐로 적음',
      },
    ])
  })

  it('묻지 않았거나 반영하지 않았거나 결과가 없으면 실패다', () => {
    const r = (results) => issueChecks(ISSUES, { results }).map((c) => c.pass)
    expect(r([{ n: 1, asked: false, reflected: true, evidence: '' }])).toEqual([false, false])
    expect(r([{ n: 1, asked: true, reflected: false, evidence: '' }])).toEqual([false, false])
    expect(r([{ n: 2, asked: true, reflected: false, evidence: '' }])).toEqual([false, false])
    expect(issueChecks(ISSUES, null).map((c) => [c.pass, c.output])).toEqual([
      [false, '판정 결과 없음'],
      [false, '판정 결과 없음'],
    ])
  })
})

describe('범위 guard와 시나리오 모양 (I111)', () => {
  /** 설계 시나리오의 기준 레포: 코드와 통과하는 레포 시험, 설계 문서 폴더 */
  function specDirs() {
    const root = tmp()
    const base = path.join(root, 'scenario/repo')
    write(base, {
      'package.json': JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }),
      'src/notify.js': 'export const send = () => true\n',
      'test/ok.test.js':
        "import { test } from 'node:test'\nimport assert from 'node:assert'\ntest('ok', () => assert.ok(true))\n",
    })
    return { root, base }
  }
  const scenario = {
    expectedFiles: ['docs/**'],
    checks: [...ISSUES, { name: '문서 밖 파일을 바꾸지 않음', guard: true, scope: true }],
  }

  it('문서만 바꾸면 범위 guard가 통과하고 코드를 바꾸면 실패한다. 지식 파일은 세지 않는다. 쟁점은 판정 모델의 자리만 둔다', () => {
    const { root, base } = specDirs()
    const docs = path.join(root, 'docs-only')
    fs.cpSync(base, docs, { recursive: true })
    write(docs, {
      'docs/design/notify.md': '# 알림\n',
      'docs/knowledge/tz.md': '---\nkind: rule\n---\n시간대는 사용자 기준\n',
    })
    const ok = judgeTree({
      tree: docs,
      baseDir: base,
      hiddenDir: path.join(root, 'none'),
      scenario,
      work: tmp(),
    })
    expect(ok.checks).toEqual([
      { name: '방해 금지 시간대', bug: null, issue: true, pending: true, pass: false, output: '' },
      { name: '결제 서술', bug: null, issue: true, pending: true, pass: false, output: '' },
      { name: '문서 밖 파일을 바꾸지 않음', bug: null, pass: true, output: '' },
    ])
    const code = path.join(root, 'code')
    fs.cpSync(docs, code, { recursive: true })
    write(code, { 'src/notify.js': 'export const send = () => false\n' })
    const bad = judgeTree({
      tree: code,
      baseDir: base,
      hiddenDir: path.join(root, 'none'),
      scenario,
      work: tmp(),
    })
    expect(bad.checks.at(-1)).toEqual({
      name: '문서 밖 파일을 바꾸지 않음',
      bug: null,
      pass: false,
      output: '기대 밖 파일: src/notify.js',
    })

    // 결과 폴더를 모으면: 범위 guard는 바뀐 폴더 모두에서, 쟁점은 한 폴더라도 통과하면 통과다
    const judged = (pass) => ({
      files: [{ file: 'docs/design/notify.md' }],
      checks: [
        { name: '방해 금지 시간대', pass },
        { name: '결제 서술', pass: false },
        { name: '문서 밖 파일을 바꾸지 않음', pass },
      ],
    })
    expect(combineChecks(scenario.checks, [judged(true), judged(false)])).toEqual([
      { name: '방해 금지 시간대', guard: false, pass: true },
      { name: '결제 서술', guard: false, pass: false },
      { name: '문서 밖 파일을 바꾸지 않음', guard: true, pass: false },
    ])
  })

  it('쟁점은 issue 글만 두고 file이나 guard를 두지 않으며 Work 하나짜리에만 둔다. 범위 검사는 guard다', () => {
    expect(isIssue(ISSUES[0])).toBe(true)
    expect(isIssue({ name: 'x', file: 'x.test.js' })).toBe(false)
    expect(shapeProblems(scenario)).toEqual([])
    expect(
      shapeProblems({
        checks: [
          { name: 'a', issue: ' ' },
          { name: 'b', issue: '쟁점', file: 'b.test.js' },
          { name: 'c', issue: '쟁점', guard: true },
          { name: 'd', issue: '쟁점', ask: 'no' },
          { name: 'e', scope: true },
          { name: 'f' },
        ],
      }),
    ).toEqual([
      '숨긴 쟁점의 issue가 비었음: a',
      '숨긴 쟁점에 file이 있음(둘 중 하나만): b',
      '숨긴 쟁점은 guard나 scope가 아님: c',
      '숨긴 쟁점의 ask는 true/false: d',
      '범위 검사는 guard여야 함: e',
      '숨긴 시험에 file이 없음: f',
    ])
    expect(
      shapeProblems({
        works: [
          { report: 'x', checks: [ISSUES[0]] },
          { report: 'y', checks: [] },
        ],
      }),
    ).toEqual(['숨긴 쟁점은 Work 하나짜리 시나리오에만 둔다: 방해 금지 시간대'])
  })
})

describe('설계의 낱말과 결과 판정 기준 (I111, I112)', () => {
  it('맨 CLI의 사람 역할은 설계를 정해 문서로 남기는 일을 하고, 결과 판정은 코드 대신 문서를 본다', () => {
    expect(words({ type: 'spec' }).task).toBe(
      '설계를 정해 문서로 남긴다(코드는 아직 바꾸지 않는다)',
    )
    expect(words({ type: 'spec' }).label).toBe('설계')
    expect(outcomeCriteria({ type: 'spec' })).toContain('숨긴 쟁점의 판정을 참고')
    expect(outcomeCriteria({ type: 'spec' })).toContain('설계 문서만 바꾸고 코드는 바꾸지 않았나')
    expect(outcomeCriteria({})).toContain('숨긴 시험을 참고하되 코드도 보라')
  })
})
