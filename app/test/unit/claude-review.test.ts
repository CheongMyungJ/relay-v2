// [실제]의 리뷰 판정 도구(test/claude/review.ts)의 [단위]. 판정이 흔한 표기를 잘못 읽으면 올바른 리뷰도
// 어긋남이 되어, 비용이 큰 [실제] M·S 경우가 잘못 실패한다 (PR #13 리뷰).
import { describe, expect, it } from 'vitest'
import { findings, judgeReview, numbers } from '../claude/review'

describe('[실제] 리뷰 판정: 반영 절과 반영하지 않은 지적 절의 번호', () => {
  it.each([
    ['- 2', [2]],
    ['- 1 — 주석을 더했다, 커밋 "review: 빈 배열 주석", npm test 통과', [1]],
    ['- 1, 2', [1, 2]],
    ['- 지적 1', [1]],
    ['- 2~4', [2, 3, 4]],
    ['- 2-4', [2, 3, 4]],
    ['- 2번, 3번, 4번', [2, 3, 4]],
    ['- 지적 2, 지적 3, 지적 4', [2, 3, 4]],
    ['- **1** — topScores 제거', [1]],
    ['1. 지적 1 — topScores 제거', [1]],
    ['- 1 - 설명', [1]],
    ['- 2 (참고용)', [2]],
    ['- 없음', []],
    ['없음', []],
    ['- 3개 테스트를 더했다', []],
  ])('%s → %j', (line, expected) => {
    expect(numbers(line)).toEqual(expected)
  })

  it('들여쓴 줄은 읽지 않는다', () => {
    expect(numbers('- 1 — topScores 제거\n  - 5개 통과\n  - 커밋 91ebcce')).toEqual([1])
  })

  it('절이 없으면 빈 목록이다', () => {
    expect(numbers(null)).toEqual([])
  })
})

describe('[실제] 리뷰 판정: 지적', () => {
  it('들여쓰지 않은 번호 줄만 지적으로 센다. 지적 안의 번호 단계는 세지 않는다', () => {
    const md = [
      '## 리뷰 지적',
      '1. [권장] a.js:3 — 제안:',
      '   1) 함수를 지운다',
      '   2) 테스트를 옮긴다',
      '2. [사소] b.js:9 — 이름',
      '',
      '## 반영',
      '없음',
    ].join('\n')
    expect(findings(md).map((f) => f.n)).toEqual([1, 2])
  })
})

describe('[실제] 리뷰와 검증의 리뷰 판정 (D229)', () => {
  const reviewMd = [
    '## 리뷰 지적',
    '1. [권장] a.js:3 — 지운다',
    '2. [사소] b.js:9 — 이름',
    '',
    '## 반영',
    '- 1 — 지웠다, 커밋 abc, npm test 통과',
    '',
    '## 반영하지 않은 지적',
    '- 2',
  ].join('\n')
  const handoff = [
    '---',
    'status: awaiting_approval',
    'decisions:',
    '  - what: 지적 1만 반영, 2는 반영하지 않음',
    '    why: 사람이 번호로 선택',
    '    by: human',
    '---',
    '## 요약',
    '반영했다.',
  ].join('\n')
  const base = {
    reviewMd,
    handoff,
    answers: 1,
    commits: ['refactor: a 지움'],
    files: ['a.js'],
  }

  it('물어서 고른 지적만 커밋했으면 통과다', () => {
    expect(judgeReview(base).problems).toEqual([])
  })

  it('반영한 지적이 있는데 커밋이 없으면 고친 커밋이 없다', () => {
    expect(judgeReview({ ...base, commits: [] }).problems).toEqual([
      '반영한 지적을 고친 커밋이 없음',
    ])
  })

  it('지적이 있는데 묻지 않았으면 어긋남이다 (D229)', () => {
    expect(judgeReview({ ...base, answers: 0 }).problems).toContain('반영할 지적을 묻지 않음')
  })
})
