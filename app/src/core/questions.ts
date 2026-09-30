import type { HumanAnswers, HumanQuestion } from '../shared/questions'

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max

/** 디스크/HTTP/IPC의 값은 타입 선언과 별개로 검증한다. Claude와 같이 최대 네 질문을 받는다. */
export function humanQuestions(value: unknown): HumanQuestion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new Error('질문은 1~4개여야 합니다.')
  }
  const ids = new Set<string>()
  return value.map((q: unknown) => {
    if (
      !record(q) ||
      !text(q['id'], 80) ||
      Object.hasOwn(Object.prototype, q['id']) ||
      !text(q['header'], 80) ||
      !text(q['question'], 4000) ||
      ids.has(q['id'])
    )
      throw new Error('질문의 id·제목·본문이 유효하지 않거나 id가 중복됩니다.')
    ids.add(q['id'])
    if (q['multiSelect'] !== undefined && typeof q['multiSelect'] !== 'boolean') {
      throw new Error('multiSelect는 true/false여야 합니다.')
    }
    let options: HumanQuestion['options']
    if (q['options'] !== undefined) {
      if (!Array.isArray(q['options']) || q['options'].length < 2 || q['options'].length > 8) {
        throw new Error('선택지는 2~8개여야 합니다. 자유 입력 질문은 선택지를 생략하세요.')
      }
      const labels = new Set<string>()
      options = q['options'].map((o: unknown) => {
        if (
          !record(o) ||
          !text(o['label'], 200) ||
          !text(o['description'], 2000) ||
          labels.has(o['label'])
        ) {
          throw new Error('선택지의 이름·설명이 유효하지 않거나 이름이 중복됩니다.')
        }
        labels.add(o['label'])
        return { label: o['label'], description: o['description'] }
      })
    }
    return {
      id: q['id'],
      header: q['header'],
      question: q['question'],
      ...(options ? { options } : {}),
      ...(q['multiSelect'] === undefined ? {} : { multiSelect: q['multiSelect'] }),
    }
  })
}

/** 선택지와 자유 입력을 같은 배열에 담는다. 빠진 답/추가 질문 id/빈 답을 거절한다. */
export function humanAnswers(questions: readonly HumanQuestion[], value: unknown): HumanAnswers {
  if (!record(value) || Object.keys(value).length !== questions.length)
    throw new Error('모든 질문에 답해주세요.')
  const entries: [string, string[]][] = []
  for (const q of questions) {
    const answers = Object.hasOwn(value, q.id) ? value[q.id] : undefined
    if (
      !Array.isArray(answers) ||
      answers.length < 1 ||
      answers.length > (q.multiSelect ? 9 : 1) ||
      !answers.every((a: unknown) => text(a, 8000)) ||
      new Set(answers).size !== answers.length
    ) {
      throw new Error(`${q.header}: 답변을 입력하거나 선택해주세요.`)
    }
    entries.push([q.id, answers.map((a: string) => a.trim())])
  }
  return Object.fromEntries(entries)
}
