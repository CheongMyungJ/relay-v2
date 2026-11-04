// 사람 역할의 hands-off 변형 (relay-v3 M2 평가 규약 Q3, E-auto)
import { describe, expect, test } from 'vitest'
import { systemPrompt } from '../lib/human.mjs'

const scenario = {
  id: 'x',
  type: 'bugfix',
  title: 't',
  purpose: 'p',
  report: '버그',
  knowledge: [{ share: 'on_ask', text: '반올림은 은행가 반올림' }],
}

describe('hands-off 사람 역할', () => {
  test('보통 사람은 받아들이기 전에 결과를 확인하고 어긋나면 지적할 수 있다', () => {
    const p = systemPrompt('cli', scenario, '설명서', 'cli')
    expect(p).toContain('결과를 받아들이기(승인, 완료, 커밋) 전에')
    expect(p).toContain('무엇이 어긋나는지 지적할 수 있다')
    expect(p).not.toContain('손을 뗀 사람')
  })

  test('hands-off는 결과를 보지 않고 지적하지 않는다. 질문에는 답한다', () => {
    const p = systemPrompt('cli', scenario, '설명서', 'cli', true)
    expect(p).toContain('손을 뗀 사람')
    expect(p).toContain('inspect_diff를 쓰지 않는다')
    expect(p).toContain('에이전트가 물으면 평소처럼 답한다')
    expect(p).not.toContain('결과를 받아들이기(승인, 완료, 커밋) 전에')
    expect(p).not.toContain('무엇이 어긋나는지 지적할 수 있다')
  })
})
