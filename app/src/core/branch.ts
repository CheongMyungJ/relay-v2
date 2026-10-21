// 작업 브랜치 이름 (D425~D427). 프로젝트 설정의 규칙으로 만들고, 사람이 새 Work 대화상자에서 고칠 수 있다.
// 끝에는 앱이 늘 임의의 4자를 붙인다: 같은 날 두 사람이 같은 이름으로 만들어 push해도 겹치지 않게 한다
import type { WorkType } from '../shared/work'

/** 규칙이 없을 때의 작업 브랜치 규칙. 예전 Work의 브랜치 이름(relay/<work-id>)과 같은 모양이다 */
export const DEFAULT_BRANCH_RULE = 'relay/{work-id}'

/** 규칙에 쓰는 자리 (D426) */
export const BRANCH_RULE_KEYS = ['work-id', 'date', 'seq', 'type', 'slug'] as const
export type BranchRuleKey = (typeof BRANCH_RULE_KEYS)[number]

/** {type} 자리의 값: 흔히 쓰는 브랜치 접두사 모양이다 */
export const BRANCH_TYPE: Readonly<Record<WorkType, string>> = {
  bugfix: 'fix',
  feature: 'feat',
  refactor: 'refactor',
  spec: 'spec',
  general: 'chore',
}

/** 끝에 붙이는 임의의 글자 수와 글자 (D427) */
export const SUFFIX_LENGTH = 4
const SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** 임의의 4자. random은 [0, 1)을 돌려준다(시험에서 바꾼다) */
export function branchSuffix(random: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    s += SUFFIX_CHARS[Math.floor(random() * SUFFIX_CHARS.length) % SUFFIX_CHARS.length]
  }
  return s
}

/** 이름 끝에 임의의 4자를 붙인다. 비었거나 끝이 구분자(-, _, /, .)면 그대로 잇고 아니면 -로 잇는다 */
export function withSuffix(name: string, suffix: string): string {
  return !name || /[-_/.]$/.test(name) ? `${name}${suffix}` : `${name}-${suffix}`
}

/**
 * 짧은 이름 칸 (D426): 영문 소문자, 숫자, -만 남긴다. 대문자는 소문자로, 공백과 _는 -로 바꾸고, 이어진 -는 하나로,
 * 앞뒤의 -는 뗀다. 남는 것이 없으면 빈 문자열이다
 */
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 규칙의 자리 이름들. 모르는 자리는 오류로 알린다 */
function ruleKeys(rule: string): string[] {
  return [...rule.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? '')
}

/** 규칙에 {slug}가 있는가: 새 Work 대화상자에 짧은 이름 칸을 보인다 */
export function ruleHasSlug(rule: string): boolean {
  return ruleKeys(rule).includes('slug')
}

/**
 * 규칙을 확인한다 (D426). 모르는 자리, 맞지 않는 괄호, 자리를 채운 이름이 브랜치 이름으로 쓸 수 없는 규칙을 받지 않는다.
 * 겹치지 않게 하는 것은 끝의 임의의 4자가 맡으므로 {work-id}나 {seq}가 없어도 된다. 받으면 null, 아니면 오류
 */
export function checkBranchRule(rule: string): string | null {
  const r = rule.trim()
  if (!r) return '브랜치 규칙이 비었습니다'
  if (/[{}]/.test(r.replace(/\{[^{}]*\}/g, ''))) return '브랜치 규칙의 { }가 맞지 않습니다'
  const keys = ruleKeys(r)
  const unknown = keys.filter((k) => !(BRANCH_RULE_KEYS as readonly string[]).includes(k))
  if (unknown.length) {
    return `브랜치 규칙에 모르는 자리가 있습니다: ${unknown.map((k) => `{${k}}`).join(', ')}`
  }
  const sample = renderBranchRule(r, {
    workId: 'w-20260101-001',
    type: 'bugfix',
    slug: 'sample',
  })
  return checkBranchName(sample) ? `이 규칙으로는 브랜치 이름을 만들 수 없습니다: ${sample}` : null
}

export interface BranchRuleInput {
  /** w-YYYYMMDD-NNN */
  workId: string
  type: WorkType
  /** 짧은 이름. 비면 {slug}와 그 바로 앞 구분자를 함께 뺀다 */
  slug: string
}

/**
 * 규칙에 값을 채운다 (D426). {date}와 {seq}는 work-id의 날짜(YYYYMMDD)와 순번(NNN)이다. {slug}가 비면 그 앞의 구분자
 * (-, _, /, .) 하나도 뺀다. 끝의 임의의 4자는 붙이지 않는다(withSuffix)
 */
export function renderBranchRule(rule: string, input: BranchRuleInput): string {
  const m = /^w-(\d{8})-(\d+)$/.exec(input.workId)
  const values: Record<BranchRuleKey, string> = {
    'work-id': input.workId,
    date: m?.[1] ?? '',
    seq: m?.[2] ?? '',
    type: BRANCH_TYPE[input.type],
    slug: slugOf(input.slug),
  }
  const r = values.slug ? rule.trim() : rule.trim().replace(/[-_/.]?\{slug\}/g, '')
  return r.replace(/\{([^{}]*)\}/g, (all, key: string) =>
    key in values ? values[key as BranchRuleKey] : all,
  )
}

/**
 * 브랜치 이름으로 쓸 수 있는가 (git check-ref-format의 규칙, git 문서 git-check-ref-format). 쓸 수 있으면 null, 아니면
 * 오류. 앱이 끝에 임의의 4자를 붙이므로 그 앞 이름을 본다
 */
export function checkBranchName(name: string): string | null {
  if (!name) return '브랜치 이름이 비었습니다'
  if (name !== name.trim()) return '브랜치 이름의 앞뒤에 공백이 있습니다'
  // 제어 문자, 공백, ~ ^ : ? * [ \ 는 쓰지 못한다
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(name))
    return `브랜치 이름에 쓸 수 없는 글자가 있습니다: ${name}`
  if (name.startsWith('-')) return '브랜치 이름은 -로 시작할 수 없습니다'
  if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) {
    return `브랜치 이름의 /가 맞지 않습니다: ${name}`
  }
  if (name.includes('..') || name.includes('@{') || name === '@') {
    return `브랜치 이름에 쓸 수 없는 모양이 있습니다: ${name}`
  }
  if (name.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock'))) {
    return `브랜치 이름의 각 부분은 .로 시작하거나 .lock으로 끝날 수 없습니다: ${name}`
  }
  if (name.endsWith('.')) return '브랜치 이름은 .로 끝날 수 없습니다'
  return null
}

/**
 * git의 ref 이름 충돌 (D115의 근거와 같음): a/b가 있으면 a/b/c를 만들 수 없고, a/b/c가 있으면 a/b를 만들 수 없다. 이미 있는
 * 브랜치(로컬과 origin)와 같거나 부딪히면 그 브랜치 이름, 아니면 null
 */
export function branchClash(name: string, existing: Iterable<string>): string | null {
  for (const b of existing) {
    if (b === name || b.startsWith(`${name}/`) || name.startsWith(`${b}/`)) return b
  }
  return null
}

/** 임의의 4자를 다시 뽑는 횟수. 36^4(약 168만) 가지라 거의 한 번에 정해진다 */
const SUFFIX_TRIES = 20

export interface PickInput {
  /** 프로젝트의 브랜치 규칙 */
  rule: string
  /** 사람이 고친 이름(끝의 4자 앞). 비었거나 null이면 규칙으로 만든다 */
  name: string | null
  /** 짧은 이름 칸 */
  slug: string
  workId: string
  type: WorkType
  /** 이미 있는 브랜치(로컬과 origin) */
  existing: readonly string[]
  random?: () => number
}

/**
 * Work를 만들 때의 작업 브랜치 (D425~D427): 사람이 고친 이름이나 규칙으로 만든 이름 끝에 임의의 4자를 붙인다. 이미 있는
 * 브랜치와 같거나 부딪히면 4자를 다시 뽑는다. 이름을 쓸 수 없거나 계속 부딪히면 오류다
 */
export function pickWorkBranch(
  input: PickInput,
): { ok: true; branch: string } | { ok: false; error: string } {
  const stem =
    input.name?.trim() ||
    renderBranchRule(input.rule, { workId: input.workId, type: input.type, slug: input.slug })
  const probe = withSuffix(stem, 'a'.repeat(SUFFIX_LENGTH))
  const bad = checkBranchName(probe)
  if (bad) return { ok: false, error: bad }
  let clash: string | null = null
  for (let i = 0; i < SUFFIX_TRIES; i++) {
    const branch = withSuffix(stem, branchSuffix(input.random))
    clash = branchClash(branch, input.existing)
    if (!clash) return { ok: true, branch }
  }
  return {
    ok: false,
    error: `브랜치 이름이 이미 있는 브랜치 ${clash ?? ''}와 부딪힙니다. 이름을 바꾸세요`,
  }
}
