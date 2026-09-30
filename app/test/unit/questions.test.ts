import { describe, expect, it } from 'vitest'
import { humanAnswers, humanQuestions } from '../../src/core/questions'

const one = {
  id: 'scope',
  header: '범위',
  question: '어디까지 바꿀까요?',
  options: [
    { label: '작게 (추천)', description: '변경을 줄입니다.' },
    { label: '전체', description: '전체 적용합니다.' },
  ],
}
describe('사람 질문 입력 경계', () => {
  it('네 질문과 자유 입력을 받아도 기본 선택이나 답을 만들지 않는다', () => {
    const questions = humanQuestions([
      one,
      { ...one, id: 'b' },
      { ...one, id: 'c' },
      { id: 'd', header: '환경', question: '환경은?' },
    ])
    expect(() => humanAnswers(questions, {})).toThrow('모든 질문')
    expect(
      humanAnswers(questions, {
        scope: ['작게 (추천)'],
        b: ['알아서 해'],
        c: ['모름'],
        d: [' Linux '],
      }).d,
    ).toEqual(['Linux'])
  })
  it('중복 id·선택지, 빈 질문, 다섯 질문을 거절한다', () => {
    for (const invalid of [
      [one, one],
      [{ ...one, question: '' }],
      Array.from({ length: 5 }, (_, i) => ({ ...one, id: String(i) })),
      [{ ...one, options: [one.options[0], one.options[0]] }],
    ]) {
      expect(() => humanQuestions(invalid)).toThrow()
    }
  })
  it('모든 답이 있어야 하며 추가 id·빈 답·단일 선택의 여러 답을 거절한다', () => {
    const questions = humanQuestions([one])
    for (const invalid of [
      { scope: [] },
      { scope: [' '] },
      { scope: ['작게 (추천)', '전체'] },
      { scope: ['전체'], other: ['extra'] },
    ])
      expect(() => humanAnswers(questions, invalid)).toThrow()
    expect(
      humanAnswers(humanQuestions([{ ...one, multiSelect: true }]), {
        scope: ['전체', '추가 의견'],
      }),
    ).toEqual({ scope: ['전체', '추가 의견'] })
  })
  it('Object의 예약 키를 질문 id로 쓰지 않아 화면·답변의 속성과 충돌하지 않는다', () => {
    for (const id of ['__proto__', 'constructor', 'toString'])
      expect(() => humanQuestions([{ ...one, id }])).toThrow()
  })
})
