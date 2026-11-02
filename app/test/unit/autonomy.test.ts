// [단위] 자율 진행의 계획 보기 (docs/design.md D542, D560). 세션이 하는 Work(D557)는 plan.md를 검사하지 않고, 있으면 읽을 수 있는
// 만큼 보인다
import { describe, expect, it } from 'vitest'
import { planView, readStrategy } from '../../src/core/autonomy'
import { autoPlan } from '../support/scenarios'

describe('[단위] 방식 줄', () => {
  it('`- 방식:` 줄을 +로 나눠 이름 그대로 읽는다. 정해진 이름이 아니어도 된다', () => {
    expect(readStrategy(autoPlan({ strategy: '- 방식: `설계 먼저` + TDD' }))).toEqual([
      '설계 먼저',
      'TDD',
    ])
    expect(readStrategy(autoPlan({ strategy: '- 방식: 자식 셋으로 나눠 나란히' }))).toEqual([
      '자식 셋으로 나눠 나란히',
    ])
    expect(readStrategy('## 전략\n- 본 신호: 없음\n')).toEqual([])
    expect(readStrategy('')).toEqual([])
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
    expect(planView('아무 글')).toEqual({ strategies: [], pieces: [], changes: [] })
    expect(planView(autoPlan()).changes).toEqual([])
  })
})
