// [실제] 리뷰(M8)의 사람 역할과 판정 (docs/implementation.md 8.4, D164).
// 리뷰가 처음 승인 대기가 되면 review.md의 번호 붙은 지적을 읽고 첫 지적만 반영하라고 터미널에서 지시한다.
// Work가 끝나면 리뷰가 그 지적만 고쳐 커밋했는지 산출물, handoff, git으로 본다. 고친 내용이 지적과 맞는지는
// 결과에 남긴 지적과 커밋, 바뀐 파일, 대화 기록(pty.log)으로 사람이 본다.
import { parseFrontMatter, sectionText } from '../../src/core/validate'
import type { ReviewView, TaskView } from '../../src/shared/views'

/** 사람 역할이 보내는 지시. 번호로 고르고, 나머지는 반영하지 않는다고 말한다 */
export const REVIEW_INSTRUCTION = '1번 지적만 반영해 주세요. 나머지 지적은 반영하지 않습니다.'

/** `## 지적` 절의 번호 붙은 지적: "1. [권장] 파일:줄 — …" */
export function findings(reviewMd: string): { n: number; text: string }[] {
  const body = sectionText(reviewMd, '지적') ?? ''
  return body
    .split('\n')
    .map((l) => /^\s*(\d+)[.)]\s+(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ n: Number(m[1]), text: (m[2] ?? '').trim() }))
}

/** 반영 절과 반영하지 않은 지적 절의 지적 번호: "- 1 — …", "- 지적 1", "- 1, 2" */
export function numbers(section: string | null): number[] {
  const out = new Set<number>()
  for (const line of (section ?? '').split('\n')) {
    const m = /^\s*[-*]\s*(?:지적\s*)?#?(\d+(?:\s*[,，]\s*\d+)*)\b/.exec(line)
    for (const n of m?.[1]?.split(/[,，]/) ?? []) out.add(Number(n.trim()))
  }
  return [...out].sort((a, b) => a - b)
}

/** driver의 instruct: 리뷰가 지적을 썼으면 첫 지적만 반영하라고 한다. 지적이 없으면 지시하지 않는다 */
export function instructReview(task: TaskView, view: ReviewView): string | null {
  if (task.node !== 'review') return null
  const md = view.artifacts.find((a) => a.name === 'review.md')?.text ?? ''
  return findings(md).length > 0 ? REVIEW_INSTRUCTION : null
}

export interface ReviewCheck {
  /** review.md의 지적 */
  findings: string[]
  /** 사람 역할이 보낸 지시 */
  instructed: string | null
  /** 반영 절과 반영하지 않은 지적 절 */
  applied: string | null
  notApplied: string | null
  /** 리뷰가 만든 커밋의 제목과 바꾼 파일 (리뷰의 시작 커밋 → verify의 시작 커밋) */
  commits: string[]
  files: string[]
  /** handoff의 사람 결정 (by: human) */
  humanDecisions: string[]
  /** 판정에서 어긋난 것. 비어 있으면 통과다 */
  problems: string[]
}

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * 리뷰의 판정 (D164): 지적을 번호 붙인 목록으로 썼다 / 지시한 뒤 커밋이 있다 / 반영 절은 1번뿐이다 /
 * 반영하지 않은 지적 절은 나머지 모두다 / 고른 것과 고르지 않은 것을 by: human 결정으로 남겼다
 */
export function judgeReview(input: {
  reviewMd: string
  handoff: string
  instructed: string | null
  commits: string[]
  files: string[]
}): ReviewCheck {
  const list = findings(input.reviewMd)
  const applied = sectionText(input.reviewMd, '반영')
  const notApplied = sectionText(input.reviewMd, '반영하지 않은 지적')
  const fm = parseFrontMatter(input.handoff)
  const decisions = fm.ok && Array.isArray(fm.data['decisions']) ? fm.data['decisions'] : []
  const humanDecisions = decisions
    .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
    .filter((d) => d['by'] === 'human')
    .map((d) => `${String(d['what'])} — ${String(d['why'])}`)
  const problems: string[] = []
  const all = list.map((f) => f.n)
  if (list.length === 0) {
    problems.push('지적이 없어 번호로 지시하지 못함')
  } else {
    if (
      !same(
        all,
        all.map((_, i) => i + 1),
      )
    )
      problems.push(`지적 번호가 1부터 차례가 아님: ${all.join(', ')}`)
    if (input.instructed === null) problems.push('지시하지 않음')
    if (input.commits.length === 0) problems.push('지시한 지적을 고친 커밋이 없음')
    const got = numbers(applied)
    if (!same(got, [1])) problems.push(`반영 절의 지적이 1번만이 아님: ${got.join(', ') || '없음'}`)
    const rest = numbers(notApplied)
    const expected = all.filter((n) => n !== 1)
    if (!same(rest, expected)) {
      problems.push(
        `반영하지 않은 지적 절이 나머지 지적(${expected.join(', ') || '없음'})이 아님: ${rest.join(', ') || '없음'}`,
      )
    }
    if (humanDecisions.length === 0) problems.push('handoff에 by: human 결정이 없음')
  }
  return {
    findings: list.map((f) => `${f.n}. ${f.text}`),
    instructed: input.instructed,
    applied,
    notApplied,
    commits: input.commits,
    files: input.files,
    humanDecisions,
    problems,
  }
}
