// [단위] 자율 진행의 관문 (docs/design.md 5.6.16, D535~D537, D541). plan.md의 방식 줄과 커밋을 앱이 본다
import { describe, expect, it } from 'vitest'
import {
  commitIssues,
  isBehaviorPath,
  planView,
  planIssues,
  PLAN_SECTIONS,
  readStrategy,
  STRATEGIES,
} from '../../src/core/autonomy'
import { checkTask } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import { autoPlan } from '../support/scenarios'

const plan = (strategy: string, extra = '') =>
  autoPlan({ strategy: `- 방식: ${strategy}\n- 본 신호: 신호` }) + extra

const commits = (...files: string[][]) => ({
  commits: files.map((f, i) => ({ commit: `c${i}`, files: f })),
})

describe('[단위] 방식 줄 (D535)', () => {
  it('이름 여섯 가운데서 +로 여럿 고르고, 백틱은 떼고 읽는다', () => {
    expect(STRATEGIES).toEqual([
      '바로 고침',
      '재현 시험 먼저',
      '안전망 먼저',
      'TDD',
      '설계 먼저',
      '스파이크 먼저',
    ])
    expect(readStrategy(plan('TDD'))).toEqual({ ok: true, strategies: ['TDD'] })
    expect(readStrategy(plan('`설계 먼저` + TDD'))).toEqual({
      ok: true,
      strategies: ['설계 먼저', 'TDD'],
    })
  })

  it('이름 뒤의 괄호 설명은 떼고 읽는다', () => {
    expect(readStrategy(plan('바로 고침 + TDD(자식 안에서)'))).toEqual({
      ok: true,
      strategies: ['바로 고침', 'TDD'],
    })
  })

  it('줄이 없거나 모르는 이름이면 plan.md의 `## 전략` 오류다', () => {
    expect(readStrategy('## 전략\n- 본 신호: 없음\n')).toEqual({ ok: false, reason: 'missing' })
    expect(readStrategy(plan('빠르게'))).toEqual({
      ok: false,
      reason: 'unknown',
      unknown: ['빠르게'],
    })
    expect(planIssues(plan('빠르게'))).toEqual([
      expect.objectContaining({
        file: 'plan.md',
        field: '전략',
        message: expect.stringContaining('빠르게'),
      }),
    ])
    expect(planIssues(autoPlan())).toEqual([])
  })

  it('설계 먼저면 `## 설계`가 있어야 한다', () => {
    expect(planIssues(plan('설계 먼저 + TDD'))).toEqual([
      expect.objectContaining({ field: '설계' }),
    ])
    expect(planIssues(plan('설계 먼저 + TDD', '\n## 설계\n- 인터페이스: median(xs)\n'))).toEqual([])
  })

  it('필수 절은 유형 정의의 단계 절이다 (D534)', () => {
    expect(PLAN_SECTIONS).toEqual([
      '전략',
      '조각',
      '바뀐 계획',
      '변경 요약',
      '완료조건별 자체 확인',
      '테스트 실행',
    ])
  })
})

describe('[단위] 커밋으로 보는 관문 (D536, D537)', () => {
  it('동작 파일은 시험 파일도 문서도 아니다', () => {
    expect(isBehaviorPath('src/avg.js')).toBe(true)
    expect(isBehaviorPath('package.json')).toBe(true)
    expect(isBehaviorPath('test/avg.test.js')).toBe(false)
    expect(isBehaviorPath('src/avg.spec.ts')).toBe(false)
    expect(isBehaviorPath('README.md')).toBe(false)
    expect(isBehaviorPath('docs/notes.txt')).toBe(false)
  })

  it('시험 먼저 방식: 시험만 바꾼 커밋이 동작을 바꾼 첫 커밋보다 앞서면 통과', () => {
    const good = commits(['test/median.test.js'], ['src/avg.js'])
    for (const s of ['TDD', '재현 시험 먼저', '안전망 먼저']) {
      expect(commitIssues(plan(s), good), s).toEqual([])
    }
  })

  it('시험 먼저 방식인데 시험이 구현과 같은 커밋이거나 뒤면 `## 전략` 오류다', () => {
    const same = commits(['src/avg.js', 'test/median.test.js'])
    const after = commits(['src/avg.js'], ['test/median.test.js'])
    for (const c of [same, after]) {
      expect(commitIssues(plan('TDD'), c)).toEqual([
        expect.objectContaining({ field: '전략', message: expect.stringContaining('TDD') }),
      ])
    }
    // 시험 먼저가 아닌 방식은 차례를 보지 않는다
    expect(commitIssues(plan('바로 고침'), same)).toEqual([])
  })

  it('동작 파일을 바꿨는데 시험 파일이 없으면 (테스트 못 더함) 줄이 있어야 한다', () => {
    const noTest = commits(['src/avg.js'])
    expect(commitIssues(plan('바로 고침'), noTest)).toEqual([
      expect.objectContaining({ field: '변경 요약' }),
    ])
    const withReason = autoPlan({
      strategy: '- 방식: 바로 고침',
      summary: '- src/avg.js — 로그 문구\n- (테스트 못 더함) 로그 문구 — 출력만 바뀜',
    })
    expect(commitIssues(withReason, noTest)).toEqual([])
    // 문서만 바꿨으면 시험이 없어도 된다
    expect(commitIssues(plan('바로 고침'), commits(['README.md']))).toEqual([])
    // 커밋이 없으면 볼 것이 없다
    expect(commitIssues(plan('TDD'), commits())).toEqual([])
  })
})

describe('[단위] 형식 검사에 붙은 관문 (D541)', () => {
  const handoff = (status: string) =>
    [
      '---',
      `status: ${status}`,
      'blocked_reason:',
      'decisions: []',
      'assumptions: []',
      'rejected: []',
      'open_questions: []',
      'intent_deviation: null',
      'risks: []',
      '---',
      '## 요약',
      '요약',
      '## 다음 task가 알아야 할 것',
      '- 없음',
      '',
    ].join('\n')
  const run = (files: Record<string, string>, autonomy?: Parameters<typeof commitIssues>[1]) =>
    checkTask({
      node: 'orchestrate',
      type: 'auto',
      files,
      config: DEFAULT_CONFIG,
      finishing: { requested: false },
      ...(autonomy ? { autonomy } : {}),
    }).errors

  it('리뷰 요청 때 plan.md의 절과 커밋을 본다. 커밋을 읽지 못했으면(autonomy 없음) 커밋 관문은 건너뛴다', () => {
    const verification = '## 완료조건 판정\n| a | 통과 | b |\n'
    const files = {
      'handoff.md': handoff('review_requested'),
      'plan.md': autoPlan(),
      'verification.md': verification,
    }
    expect(run(files, commits(['test/median.test.js'], ['src/avg.js']))).toEqual([])
    expect(run(files, commits(['src/avg.js', 'test/median.test.js']))).toEqual([
      expect.objectContaining({ file: 'plan.md', field: '전략' }),
    ])
    expect(run(files)).toEqual([])
    expect(run({ ...files, 'plan.md': '## 전략\n- 방식: TDD\n' })).toEqual(
      PLAN_SECTIONS.filter((s) => s !== '전략').map((s) =>
        expect.objectContaining({ file: 'plan.md', field: s }),
      ),
    )
  })

  it('일하는 중(handoff 없음)에는 방식 줄만 본다', () => {
    expect(run({ 'plan.md': '## 전략\n- 방식: 빠르게\n' })).toEqual([
      expect.objectContaining({ field: '전략' }),
    ])
    expect(run({ 'plan.md': '## 전략\n- 방식: TDD\n' }, commits(['src/avg.js']))).toEqual([])
  })
})

describe('[단위] 지켜보기의 계획 (D542)', () => {
  it('방식, 조각마다 실행 형태와 결과, 바뀐 계획을 읽는다. 결과가 비었거나 진행 중이면 끝나지 않은 것이다', () => {
    const text = autoPlan({ strategy: '- 방식: 설계 먼저 + TDD' })
      .replace(
        '| p2 | median 구현 | 직접 | `src/avg.js` | 시험이 통과함 | 끝남 |',
        '| p2 | median 구현 | 서브에이전트 | `src/avg.js` | 시험이 통과함 | 진행 중 |\n| p3 | 문서 | 직접 | `README.md` | 예시 | |',
      )
      .replace('## 바뀐 계획\n- 없음', '## 바뀐 계획\n- p3를 더함: README 예시가 필요함')
    expect(planView(text)).toEqual({
      strategies: ['설계 먼저', 'TDD'],
      pieces: [
        { id: 'p1', goal: 'median 시험', how: '직접', result: '끝남', done: true },
        { id: 'p2', goal: 'median 구현', how: '서브에이전트', result: '진행 중', done: false },
        { id: 'p3', goal: '문서', how: '직접', result: '', done: false },
      ],
      changes: ['p3를 더함: README 예시가 필요함'],
    })
  })

  it('형식이 틀려도 읽을 수 있는 만큼 돌려준다', () => {
    expect(planView('## 전략\n- 방식: 빠르게\n')).toEqual({
      strategies: [],
      pieces: [],
      changes: [],
    })
    expect(planView(autoPlan()).changes).toEqual([])
  })
})
