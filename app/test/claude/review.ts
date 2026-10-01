// [실제] 리뷰와 검증(verify)의 리뷰 판정 (docs/implementation.md 8.4, 5.6.6, D229).
// verify는 지적을 쓰고, 지적이 있으면 반영할 지적을 AskUserQuestion으로 묻는다. 사람 역할(driver)은 첫 선택지(추천)로
// 답한다. Work가 끝나면 verify가 물었는지, 고른 지적만 고쳐 커밋했는지, 반영 절과 반영하지 않은 지적 절이 지적을
// 빠짐없이 나눴는지를 산출물, handoff, git으로 본다. 고친 내용이 지적과 맞는지는 결과에 남긴 지적과 커밋, 바뀐 파일,
// 대화 기록(pty.log)으로 사람이 본다.
import fs from 'node:fs'
import path from 'node:path'
import { parseFrontMatter, sectionText } from '../../src/core/validate'

/**
 * verification.md의 `## 리뷰 지적` 절의 번호 붙은 지적: "1. [권장] 파일:줄 — …". 들여쓰지 않은 줄만 센다. 지적 안에 번호 붙은
 * 하위 단계("   1) 함수를 지운다")가 있어도 지적으로 세지 않는다
 */
export function findings(reviewMd: string): { n: number; text: string }[] {
  const body = sectionText(reviewMd, '리뷰 지적') ?? ''
  return body
    .split('\n')
    .map((l) => /^(\d+)[.)]\s+(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ n: Number(m[1]), text: (m[2] ?? '').trim() }))
}

/** 지적 번호 하나나 범위: "2", "지적 2", "#2", "2번", "2~4", "2-4" */
const ONE = String.raw`(?:지적\s*)?#?\d+(?:\s*[~\-–]\s*\d+)?\s*번?`
/**
 * 목록 줄의 머리에 오는 지적 번호들: "2, 3", "2번, 3번", "지적 2, 지적 3", "**1**". 번호 뒤에는 공백, 줄 끝이나
 * 설명을 여는 기호(—, :, ( 등)가 온다. "3개 테스트"처럼 번호가 아닌 수는 읽지 않는다
 */
const HEAD = new RegExp(
  String.raw`^\*{0,2}\s*(${ONE}(?:\s*(?:[,，、/]|와|과|및)\s*${ONE})*)\s*\*{0,2}(?=\s|$|[—–:(.,])`,
)

/**
 * 반영 절과 반영하지 않은 지적 절의 지적 번호. 들여쓰지 않은 목록 줄(-, *, +, "1.")만 읽고, 그 아래 들여쓴 줄
 * ("  - 5개 통과")은 읽지 않는다. 범위(2~4, 2-4)는 펼친다
 */
export function numbers(section: string | null): number[] {
  const out = new Set<number>()
  for (const line of (section ?? '').split('\n')) {
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)?.[1]
    const head = item === undefined ? undefined : HEAD.exec(item)?.[1]
    if (head === undefined) continue
    for (const m of head.matchAll(/(\d+)(?:\s*[~\-–]\s*(\d+))?/g)) {
      const from = Number(m[1])
      const to = m[2] === undefined ? from : Number(m[2])
      for (let n = from; n <= to && n - from < 100; n++) out.add(n)
    }
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * AskUserQuestion의 질문 하나를 한 줄로: 머리, 질문, 선택지 이름. 판정이 읽는 글이다.
 * 입력은 도구 입력(`{questions: [{header, question, options: [{label}]}]}`)이다
 */
export function questionTexts(input: unknown): string[] {
  const qs = (input as { questions?: unknown } | null)?.questions
  if (!Array.isArray(qs)) return []
  return qs.map((q: unknown) => {
    const r = (q ?? {}) as { header?: unknown; question?: unknown; options?: unknown }
    const labels = Array.isArray(r.options)
      ? r.options.map((o: unknown) => String((o as { label?: unknown } | null)?.label ?? ''))
      : []
    return [r.header, r.question, ...labels].filter((x) => typeof x === 'string' && x).join(' / ')
  })
}

/**
 * 실제 claude가 세션 기록(`<설정 폴더>/projects/<프로젝트>/<세션 id>.jsonl`)에 남긴 AskUserQuestion의 질문들.
 * 기록을 찾지 못하면 빈 목록이다
 */
export function transcriptQuestions(configDir: string, sessionId: string): string[] {
  const root = path.join(configDir, 'projects')
  if (!fs.existsSync(root)) return []
  const file = fs
    .readdirSync(root)
    .map((d) => path.join(root, d, `${sessionId}.jsonl`))
    .find((f) => fs.existsSync(f))
  if (!file) return []
  const out: string[] = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('AskUserQuestion')) continue
    let entry: { message?: { content?: unknown } }
    try {
      entry = JSON.parse(line) as typeof entry
    } catch {
      continue
    }
    const content = entry.message?.content
    if (!Array.isArray(content)) continue
    for (const c of content as { type?: string; name?: string; input?: unknown }[]) {
      if (c.type === 'tool_use' && c.name === 'AskUserQuestion') out.push(...questionTexts(c.input))
    }
  }
  return out
}

/** 반영할 지적을 묻는 질문인가 (D229). 스킬은 선택지를 "…반영" / "반영하지 않음"으로 준다 */
export const asksFindings = (question: string): boolean => /반영/.test(question)

export interface ReviewCheck {
  /** verification.md의 리뷰 지적 */
  findings: string[]
  /** verify가 물은 질문 (머리, 질문, 선택지 이름) */
  questions: string[]
  /** 반영 절과 반영하지 않은 지적 절 */
  applied: string | null
  notApplied: string | null
  /** verify가 만든 커밋의 제목 (verify의 시작 커밋 → verify를 승인한 때의 HEAD) */
  commits: string[]
  /** verify가 바꾼 파일 (verify의 시작 커밋 → verify를 승인한 때의 HEAD) */
  files: string[]
  /** handoff의 사람 결정 (by: human) */
  humanDecisions: string[]
  /** 판정에서 어긋난 것. 비어 있으면 통과다 */
  problems: string[]
}

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * 리뷰의 판정 (5.6.6, D229): 지적을 번호 붙인 목록으로 썼다(없으면 "없음") / 지적이 있으면 반영할 지적을 물었다 /
 * 반영 절과 반영하지 않은 지적 절이 지적을 빠짐없이 겹치지 않게 나눴다 / 반영한 지적이 있으면 커밋이 있고, 없으면
 * 코드를 바꾸지 않았다 / 고른 것과 고르지 않은 것을 by: human 결정으로 남겼다
 */
export function judgeReview(input: {
  reviewMd: string
  handoff: string
  /** verify가 물은 질문들 (questionTexts) */
  questions: string[]
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
  if (sectionText(input.reviewMd, '리뷰 지적') === null)
    problems.push('verification.md에 `## 리뷰 지적` 절이 없음')
  if (list.length === 0) {
    // 지적이 없으면 묻지 않고 코드를 바꾸지 않는다
    if (input.commits.length > 0) {
      problems.push(`지적이 없는데 커밋함: ${input.commits.join(' / ')}`)
    }
  } else {
    if (
      !same(
        all,
        all.map((_, i) => i + 1),
      )
    )
      problems.push(`지적 번호가 1부터 차례가 아님: ${all.join(', ')}`)
    // 다른 질문(테스트 약화 등)만 물었으면 반영할 지적을 묻지 않은 것이다
    if (!input.questions.some(asksFindings)) problems.push('반영할 지적을 묻지 않음')
    const got = numbers(applied)
    const rest = numbers(notApplied)
    const covered = [...new Set([...got, ...rest])].sort((a, b) => a - b)
    if (got.some((n) => rest.includes(n))) {
      problems.push(
        `반영 절과 반영하지 않은 지적 절에 함께 있는 지적: ${got.filter((n) => rest.includes(n)).join(', ')}`,
      )
    }
    if (!same(covered, all)) {
      problems.push(
        `반영 절과 반영하지 않은 지적 절이 지적(${all.join(', ')})을 나누지 않음: ${covered.join(', ') || '없음'}`,
      )
    }
    if (got.length > 0 && input.commits.length === 0)
      problems.push('반영한 지적을 고친 커밋이 없음')
    if (got.length === 0 && input.commits.length > 0) {
      problems.push(`반영한 지적이 없는데 커밋함: ${input.commits.join(' / ')}`)
    }
    if (humanDecisions.length === 0) problems.push('handoff에 by: human 결정이 없음')
  }
  return {
    findings: list.map((f) => `${f.n}. ${f.text}`),
    questions: input.questions,
    applied,
    notApplied,
    commits: input.commits,
    files: input.files,
    humanDecisions,
    problems,
  }
}
