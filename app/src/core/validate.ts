// handoff와 intent 초안의 형식 검사 (5.2.1, D38). handoff 머리글을 YAML로 읽어 JSON Schema로 검사하고(D84),
// intent 초안은 머리글이 없어 본문만 본다(D236, I58).
// 스키마로 나타낼 수 없는 것은 코드로 검사한다. 형식만 보고 내용은 판단하지 않는다 (D21).
// 오류 메시지에는 필드와 어긴 규칙을 적는다 (D87). 정의되지 않은 필드와 분량 초과는 경고만 한다 (D85).
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020'
import { parseDocument } from 'yaml'
import type { AppConfig } from '../shared/config'
import type { Handoff, HandoffStatus, TaskNode } from '../shared/contracts'
import handoffSchemaV1 from '../shared/generated/handoff.v1.schema.json'
import type { CheckSummary, FormatIssue, WorkType } from '../shared/work'
import { ALL_NODES, NODE_INFO, recommendableNodes } from './pipeline'

/** 지금 쓰는 형식 버전 (5.2.1). task를 시작할 때 work.json에 기록하고, 그 버전의 스키마로 검사한다 */
export const FORMAT_VERSION = 1

export const HANDOFF_FILE = 'handoff.md'
export const INTENT_DRAFT_FILE = 'intent.draft.md'
export const PR_FILE = 'pr.md'
/** PR 대응 task의 산출물 (5.6.7, D187) */
export const RESPONSE_FILE = 'response.md'
export const REPLIES_FILE = 'replies.md'
/** 원인 분석과 수정의 산출물 (5.6.5, D228) */
export const FIX_FILE = 'fix.md'
/** 설계와 계획의 산출물 (5.6.8, D244) */
export const DESIGN_FILE = 'design.md'
/** 구현의 산출물 (5.6.9, D250) */
export const IMPLEMENT_FILE = 'implement.md'
/** 계획과 리팩터링의 산출물 (5.6.10, D272) */
export const REFACTOR_FILE = 'refactor.md'
/** 리뷰와 검증의 산출물: 리뷰 지적과 완료조건 판정 (5.6.6, D229) */
export const VERIFICATION_FILE = 'verification.md'

/** 본문 필수 절 (5.2.1) */
export const HANDOFF_SECTIONS = ['요약', '다음 task가 알아야 할 것'] as const
export const INTENT_SECTIONS = ['목표', '비목표', '원하는 결과', '완료조건'] as const
const CRITERIA_SECTION = '완료조건'
const CRITERIA_PREFIX = '- [ ] '

// 스키마를 걷는 데 쓰는 부분만 적은 모양
interface SchemaNode {
  type?: string
  enum?: unknown[]
  const?: unknown
  properties?: Record<string, SchemaNode>
  items?: SchemaNode
  oneOf?: SchemaNode[]
  required?: string[]
  if?: SchemaNode
}

interface Checker<T> {
  schema: SchemaNode
  validate: ValidateFunction<T>
}

interface Schemas {
  handoff: Checker<Handoff>
}

// 형식 버전마다의 스키마 (5.2.1). 처음 쓸 때 컴파일한다.
const SOURCES: Readonly<Record<number, { handoff: SchemaNode }>> = {
  1: { handoff: handoffSchemaV1 },
}
const compiled = new Map<number, Schemas>()

function schemas(version: number): Schemas {
  const cached = compiled.get(version)
  if (cached) return cached
  const source = SOURCES[version]
  if (!source) throw new Error(`형식 버전 ${version}의 스키마가 없다`)
  const ajv = new Ajv2020({ allErrors: true })
  const s: Schemas = {
    handoff: { schema: source.handoff, validate: ajv.compile<Handoff>(source.handoff) },
  }
  compiled.set(version, s)
  return s
}

// ---------- 머리글 ----------

export type FrontMatter =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; error: string; body: string }

/** 줄 끝(CRLF)과 BOM을 맞춘다. Windows 편집기가 쓴 파일도 같게 읽는다 */
export function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

/** 첫 줄 ---부터 다음 --- 줄까지를 YAML 머리글로 읽고, 나머지를 본문으로 돌려준다 */
export function parseFrontMatter(text: string): FrontMatter {
  const lines = normalizeText(text).split('\n')
  if (lines[0]?.trimEnd() !== '---') {
    return {
      ok: false,
      error: '머리글 없음: 첫 줄이 `---`인 YAML 머리글이 필요함',
      body: lines.join('\n'),
    }
  }
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---')
  if (end < 0) {
    return { ok: false, error: '머리글이 닫히지 않음: 머리글 끝에 `---` 줄이 필요함', body: '' }
  }
  const body = lines.slice(end + 1).join('\n')
  const doc = parseDocument(lines.slice(1, end).join('\n'))
  const [yamlError] = doc.errors
  if (yamlError) {
    return { ok: false, error: `머리글 YAML을 읽을 수 없음: ${firstLine(yamlError.message)}`, body }
  }
  let data: unknown
  try {
    data = doc.toJS()
  } catch (e) {
    return { ok: false, error: `머리글 YAML을 읽을 수 없음: ${firstLine(String(e))}`, body }
  }
  if (!isRecord(data)) return { ok: false, error: '머리글이 `필드: 값` 목록이 아님', body }
  return { ok: true, data, body }
}

// ---------- 스키마 오류를 읽을 수 있는 메시지로 ----------

const TYPE_NAMES: Record<string, string> = {
  array: '목록',
  object: '객체',
  string: '문자열',
  number: '숫자',
  integer: '정수',
  boolean: 'true/false',
  null: 'null',
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function firstLine(s: string): string {
  return s.split('\n')[0]?.trim() ?? ''
}

function jsonType(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function typeMatches(expected: string | undefined, v: unknown): boolean {
  const t = jsonType(v)
  return expected === t || (expected === 'number' && t === 'integer')
}

/** 지금 값: 비어 있으면 "비어 있음", 문자열과 숫자는 그대로, 목록과 객체는 형식 이름 */
function describeValue(v: unknown): string {
  if (v === null || v === undefined) return '비어 있음'
  if (typeof v === 'string') return v === '' ? '빈 문자열' : clip(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return TYPE_NAMES[jsonType(v)] ?? jsonType(v)
}

function describeType(v: unknown): string {
  return v === null || v === undefined ? '비어 있음' : (TYPE_NAMES[jsonType(v)] ?? jsonType(v))
}

function describeBranch(s: SchemaNode): string {
  if (s.type === 'object' && s.required) return `{${s.required.join(', ')}}`
  return TYPE_NAMES[s.type ?? ''] ?? s.type ?? '?'
}

function clip(s: string, max = 60): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max)}…` : one
}

/** JSON 포인터(/decisions/0/by)를 필드 경로(decisions[0].by)로 */
function fieldPath(pointer: string, extra?: string): string {
  const parts = pointer
    .split('/')
    .slice(1)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (extra !== undefined) parts.push(extra)
  return parts.reduce((acc, p) => (/^\d+$/.test(p) ? `${acc}[${p}]` : acc ? `${acc}.${p}` : p), '')
}

function valueAt(data: unknown, pointer: string): unknown {
  let v = data
  for (const p of pointer.split('/').slice(1)) {
    const key = p.replace(/~1/g, '/').replace(/~0/g, '~')
    if (Array.isArray(v)) v = v[Number(key)]
    else if (isRecord(v)) v = v[key]
    else return undefined
  }
  return v
}

/** 스키마 경로(#/properties/x/oneOf)가 가리키는 스키마 조각 */
function schemaAt(schema: SchemaNode, path: string): unknown {
  let s: unknown = schema
  for (const p of path.replace(/^#\/?/, '').split('/').filter(Boolean)) {
    if (Array.isArray(s)) s = s[Number(p)]
    else if (isRecord(s)) s = s[p]
    else return undefined
  }
  return s
}

/** if/then의 조건 문구. 예: "`status: blocked`일 때" */
function conditionText(schema: SchemaNode): string {
  const props = Object.entries(schema.if?.properties ?? {})
  const parts = props
    .filter(([, s]) => s.const !== undefined)
    .map(([k, s]) => `\`${k}: ${String(s.const)}\``)
  return parts.length ? `${parts.join(', ')}일 때` : '조건에 맞을 때'
}

interface FieldError {
  field: string
  message: string
}

function translate(e: ErrorObject, data: unknown, condition: string | null): FieldError {
  const value = valueAt(data, e.instancePath)
  const params = e.params as Record<string, unknown>
  switch (e.keyword) {
    case 'required': {
      const field = fieldPath(e.instancePath, String(params['missingProperty']))
      return {
        field,
        message: `\`${field}\` 없음: ${condition ? `${condition} 필수` : '필수 필드'}`,
      }
    }
    case 'type': {
      const field = fieldPath(e.instancePath)
      const expected = [params['type']].flat().map((t) => TYPE_NAMES[String(t)] ?? String(t))
      if (condition && (value === null || value === undefined)) {
        return { field, message: `\`${field}\` 없음: ${condition} 필수` }
      }
      const rule = condition ? `${condition} ${expected.join(' 또는 ')}` : expected.join(' 또는 ')
      return {
        field,
        message: `\`${field}\` 형식이 틀림 (기대: ${rule}, 지금: ${describeType(value)})`,
      }
    }
    case 'enum': {
      const field = fieldPath(e.instancePath)
      const allowed = (params['allowedValues'] as unknown[]).map(String).join(' | ')
      return {
        field,
        message: `\`${field}\` 값이 허용값이 아님 (허용값: ${allowed}, 지금: ${describeValue(value)})`,
      }
    }
    case 'const': {
      const field = fieldPath(e.instancePath)
      return {
        field,
        message: `\`${field}\` 값이 틀림 (기대: ${String(params['allowedValue'])}, 지금: ${describeValue(value)})`,
      }
    }
    case 'minLength': {
      const field = fieldPath(e.instancePath)
      return {
        field,
        message: `\`${field}\` 값이 비어 있음: ${condition ? `${condition} 필수` : '빈 문자열은 안 됨'}`,
      }
    }
    default: {
      const field = fieldPath(e.instancePath)
      return { field, message: `\`${field}\`: ${e.message ?? e.keyword}` }
    }
  }
}

/**
 * ajv 오류를 필드마다 하나의 메시지로 바꾼다.
 * - if/then(예: blocked면 blocked_reason 필수)은 then의 오류만 남기고 조건을 붙인다.
 * - oneOf(예: null 또는 객체)는 값의 형식에 맞는 가지의 오류만 남긴다. 맞는 가지가 없으면 형식 오류 하나로 쓴다.
 */
function schemaErrors(
  schema: SchemaNode,
  data: unknown,
  errors: readonly ErrorObject[],
): FieldError[] {
  const dropped = new Set<ErrorObject>()
  const extra: FieldError[] = []
  for (const e of errors) {
    if (e.keyword === 'if') dropped.add(e)
    if (e.keyword !== 'oneOf') continue
    dropped.add(e)
    const branches = schemaAt(schema, e.schemaPath)
    if (!Array.isArray(branches)) continue
    const value = valueAt(data, e.instancePath)
    const match = (branches as SchemaNode[]).findIndex((b) => typeMatches(b.type, value))
    for (const other of errors) {
      if (!other.schemaPath.startsWith(`${e.schemaPath}/`)) continue
      const own = other.schemaPath === `${e.schemaPath}/${match}/type`
      if (match < 0 || !other.schemaPath.startsWith(`${e.schemaPath}/${match}/`) || own) {
        dropped.add(other)
      }
    }
    if (match < 0) {
      const field = fieldPath(e.instancePath)
      const expected = (branches as SchemaNode[]).map(describeBranch).join(' 또는 ')
      extra.push({
        field,
        message: `\`${field}\` 형식이 틀림 (기대: ${expected}, 지금: ${describeType(value)})`,
      })
    }
  }
  const condition = conditionText(schema)
  const kept = errors.filter((e) => !dropped.has(e))
  // 조건부 규칙이 더 구체적이라 먼저 둔다. 같은 필드는 첫 메시지만 남긴다.
  const ordered = [
    ...kept
      .filter((e) => e.schemaPath.startsWith('#/then/'))
      .map((e) => translate(e, data, condition)),
    ...kept.filter((e) => !e.schemaPath.startsWith('#/then/')).map((e) => translate(e, data, null)),
    ...extra,
  ]
  const seen = new Set<string>()
  return ordered.filter((f) => !seen.has(f.field) && seen.add(f.field))
}

/** 스키마에 없는 필드 (D85). 중첩 객체(decisions의 항목, recommended_next 등)도 본다 */
function unknownFields(schema: SchemaNode, value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    const items = schema.items
    return items ? value.flatMap((v, i) => unknownFields(items, v, `${path}[${i}]`)) : []
  }
  if (!isRecord(value)) return []
  const s = schema.properties ? schema : schema.oneOf?.find((b) => b.type === 'object')
  if (!s?.properties) return []
  const props = s.properties
  return Object.entries(value).flatMap(([k, v]) => {
    const p = path ? `${path}.${k}` : k
    const child = props[k]
    return child ? unknownFields(child, v, p) : [p]
  })
}

// ---------- 본문 ----------

/** 코드 펜스 밖의 줄에 표시를 붙여 돌려준다 */
function markFences(lines: readonly string[]): { line: string; fenced: boolean }[] {
  let fence: string | null = null
  return lines.map((line) => {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (m?.[1]) {
      const mark = m[1]
      if (fence === null) {
        fence = mark
        return { line, fenced: true }
      }
      if (mark[0] === fence[0] && mark.length >= fence.length) {
        fence = null
        return { line, fenced: true }
      }
    }
    return { line, fenced: fence !== null }
  })
}

function headingText(line: string, level: number): string | null {
  const m = new RegExp(`^#{${level}}[ \\t]+(.*?)[ \\t]*$`).exec(line)
  return m?.[1] ?? null
}

/** 본문의 ## 절 이름 (코드 펜스 안은 빼고) */
export function sectionNames(body: string): string[] {
  return markFences(body.split('\n'))
    .filter((l) => !l.fenced)
    .map((l) => headingText(l.line, 2))
    .filter((h): h is string => h !== null)
}

/** ## name 절의 줄 (다음 # 또는 ## 제목 앞까지) */
function sectionLines(body: string, name: string): string[] | null {
  const lines = markFences(body.split('\n'))
  const start = lines.findIndex((l) => !l.fenced && headingText(l.line, 2) === name)
  if (start < 0) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => !l.fenced && /^#{1,2}[ \t]/.test(l.line))
  return (end < 0 ? rest : rest.slice(0, end)).map((l) => l.line)
}

/** ## name 절의 본문. 앞뒤 빈 줄은 뺀다. 절이 없으면 null */
export function sectionText(body: string, name: string): string | null {
  const lines = sectionLines(normalizeText(body), name)
  return lines === null ? null : lines.join('\n').trim()
}

function missingSections(
  file: string,
  body: string,
  required: readonly string[],
  what: string,
): FormatIssue[] {
  const names = sectionNames(body)
  return required
    .filter((s) => !names.includes(s))
    .map((s) => ({
      file,
      part: 'body',
      field: s,
      message: `\`## ${s}\` 절 없음: ${what}의 필수 절`,
    }))
}

function charCount(s: string): number {
  return [...s.trim()].length
}

function lengthWarning(file: string, body: string, limit: number, what: string): FormatIssue[] {
  const n = charCount(body)
  return n > limit
    ? [
        {
          file,
          part: 'body',
          message: `${what}이 분량 기준을 넘음 (기준: ${limit}자, 지금: ${n}자)`,
        },
      ]
    : []
}

// ---------- 파일별 검사 ----------

/** 파일 하나의 오류와 경고 */
export interface IssueCheck {
  errors: FormatIssue[]
  warnings: FormatIssue[]
}

export interface DocCheck<T> extends IssueCheck {
  /** 머리글이 스키마를 통과했을 때의 값 */
  value: T | null
}

interface HeaderCheck<T> extends DocCheck<T> {
  data: Record<string, unknown> | null
  body: string
}

function checkHeader<T>(
  file: string,
  text: string,
  s: { schema: SchemaNode; validate: ValidateFunction<T> },
): HeaderCheck<T> {
  const fm = parseFrontMatter(text)
  if (!fm.ok) {
    return {
      value: null,
      data: null,
      body: fm.body,
      errors: [{ file, part: 'header', message: fm.error }],
      warnings: [],
    }
  }
  const valid = s.validate(fm.data)
  const errors: FormatIssue[] = valid
    ? []
    : schemaErrors(s.schema, fm.data, s.validate.errors ?? []).map((f) => ({
        file,
        part: 'header',
        field: f.field,
        message: f.message,
      }))
  const warnings: FormatIssue[] = unknownFields(s.schema, fm.data).map((f) => ({
    file,
    part: 'header',
    field: f,
    message: `정의되지 않은 필드 \`${f}\`: 앱은 무시함`,
  }))
  return { value: valid ? (fm.data as T) : null, data: fm.data, body: fm.body, errors, warnings }
}

export interface HandoffCheckOptions {
  node: TaskNode
  /** Work의 업무 유형. recommended_next.node의 허용값이 유형마다 다르다 (3.2) */
  type: WorkType
  warnChars: number
  formatVersion?: number
}

export interface HandoffCheck extends DocCheck<Handoff> {
  /** 머리글에서 읽은 status. 다른 오류가 있어도 읽을 수 있으면 채운다 */
  status: HandoffStatus | null
  /** 머리글이 스키마를 통과했을 때의 값. 본문이나 추가 검사의 오류가 있어도 채운다 (D112) */
  header: Handoff | null
}

/** handoff.md 검사 (5.2, 5.2.1) */
export function checkHandoff(text: string, opts: HandoffCheckOptions): HandoffCheck {
  const file = HANDOFF_FILE
  const h = checkHeader(file, text, schemas(opts.formatVersion ?? FORMAT_VERSION).handoff)
  const errors = [...h.errors]
  const rec = h.data?.['recommended_next']
  const node = isRecord(rec) ? rec['node'] : undefined
  if (ALL_NODES.some((n) => n === node)) {
    const allowed = recommendableNodes(opts.type, opts.node)
    if (!allowed.some((n) => n === node)) {
      errors.push({
        file,
        part: 'header',
        field: 'recommended_next.node',
        message: `\`recommended_next.node\` 값이 선택 가능한 다음 단계가 아님 (허용값: ${allowed.join(' | ') || '없음'}, 지금: ${String(node)})`,
      })
    }
  }
  if (h.data) errors.push(...missingSections(file, h.body, HANDOFF_SECTIONS, 'handoff 본문'))
  const status = h.data?.['status']
  return {
    value: errors.length ? null : h.value,
    status: status === 'awaiting_approval' || status === 'blocked' ? status : null,
    header: h.value,
    errors,
    warnings: [
      ...h.warnings,
      ...(h.data ? lengthWarning(file, h.body, opts.warnChars, 'handoff 본문') : []),
    ],
  }
}

/**
 * intent 초안의 머리글을 뗀다 (D236, I58). 초안에는 머리글이 없다: 유형과 버전은 앱이 [의도 승인] 때 붙인다. 습관처럼
 * 쓴 머리글(첫 줄 `---`부터 닫는 `---`까지)이 있으면 읽지 않고 떼어 본문만 돌려준다
 */
export function intentDraftBody(text: string): { body: string; header: boolean } {
  const lines = normalizeText(text).split('\n')
  const close =
    lines[0]?.trimEnd() === '---' ? lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---') : -1
  // 첫 줄이 수평선인 본문(`---`, `## 목표` …)을 머리글로 잘라 내지 않게, 사이의 줄이 모두 YAML 모양일 때만 머리글이다
  const end = close > 0 && lines.slice(1, close).every(isYamlLine) ? close : -1
  return end < 0
    ? { body: lines.join('\n'), header: false }
    : { body: lines.slice(end + 1).join('\n'), header: true }
}

/** YAML 머리글의 줄 모양: 빈 줄, `키:`, 들여 쓴 줄, `- ` 목록 */
function isYamlLine(line: string): boolean {
  return (
    /^\s*$/.test(line) ||
    /^[A-Za-z_][\w.-]*\s*:/.test(line) ||
    /^\s+\S/.test(line) ||
    /^- /.test(line)
  )
}

/** intent.draft.md 검사 (5.3, D38). 본문 절만 본다. 머리글이 있으면 경고만 한다 (I58) */
export function checkIntentDraft(text: string, opts: { warnChars: number }): IssueCheck {
  const file = INTENT_DRAFT_FILE
  const { body, header } = intentDraftBody(text)
  const errors = missingSections(file, body, INTENT_SECTIONS, 'intent 초안 본문')
  const criteria = sectionLines(body, CRITERIA_SECTION) ?? []
  for (const line of criteria.filter((l) => l.trim())) {
    if (!line.startsWith(CRITERIA_PREFIX)) {
      errors.push({
        file,
        part: 'body',
        field: CRITERIA_SECTION,
        message: `\`## ${CRITERIA_SECTION}\`의 줄이 \`${CRITERIA_PREFIX}\`로 시작하지 않음 (지금: ${clip(line)})`,
      })
    }
  }
  const warnings: FormatIssue[] = header
    ? [
        {
          file,
          part: 'header',
          message:
            '머리글은 읽지 않음: intent 초안에는 머리글이 없다. 유형과 버전은 앱이 의도 승인 때 붙인다 (D236)',
        },
      ]
    : []
  return {
    errors,
    warnings: [...warnings, ...lengthWarning(file, body, opts.warnChars, 'intent 초안 본문')],
  }
}

/** pr.md의 첫 줄은 `# <PR 제목>`이다 (D62) */
export function checkPr(text: string): FormatIssue[] {
  const first = normalizeText(text).split('\n')[0] ?? ''
  return /^# +\S/.test(first)
    ? []
    : [
        {
          file: PR_FILE,
          part: 'body',
          message: `\`${PR_FILE}\` 첫 줄이 \`# <PR 제목>\`이 아님 (지금: ${first.trim() ? clip(first) : '빈 줄'})`,
        },
      ]
}

/** replies.md의 절 하나: `## <항목 id>`와 그 아래 본문 (D190) */
export interface ReplySection {
  id: string
  /** 절의 본문. 앞뒤 빈 줄은 뺀다 */
  body: string
}

/**
 * replies.md의 `## <항목 id>` 절 (D190). 제목의 id는 앞뒤 공백을 떼고, 백틱으로 감쌌으면 벗긴다. 첫 절 앞의 글은 절이
 * 아니다. 본문은 다음 `#`이나 `##` 제목 앞까지다(코드 펜스 안의 제목은 치지 않음)
 */
export function replySections(text: string): ReplySection[] {
  const body = normalizeText(text)
  return sectionNames(body).map((name) => {
    const id = name
      .trim()
      .replace(/^`([^`]+)`$/, '$1')
      .trim()
    return { id, body: sectionText(body, name) ?? '' }
  })
}

/**
 * replies.md 검사 (5.2.1, D190): 이번 라운드의 코멘트 항목(replyItems)마다 `## <항목 id>` 절이 하나씩 있고, 모르는 id가
 * 없고, 답글 본문이 비어 있지 않다. 코멘트 항목이 있는데 파일이 없으면 오류다. 이 오류는 [오류 무시하고 승인]으로 넘길 수
 * 없다 (D204, core/approval)
 */
export function checkReplies(
  text: string | undefined,
  replyItems: readonly string[],
): FormatIssue[] {
  const file = REPLIES_FILE
  if (text === undefined) {
    return replyItems.length
      ? [
          {
            file,
            part: 'file',
            message: `\`${file}\` 없음: 이번 라운드의 코멘트 항목(${replyItems.join(', ')})마다 답글이 필요함`,
          },
        ]
      : []
  }
  const sections = replySections(text)
  const errors: FormatIssue[] = []
  for (const id of replyItems) {
    const found = sections.filter((s) => s.id === id)
    if (found.length === 0) {
      errors.push({
        file,
        part: 'body',
        field: id,
        message: `\`## ${id}\` 절 없음: 이번 라운드의 코멘트 항목`,
      })
    } else if (found.length > 1) {
      errors.push({
        file,
        part: 'body',
        field: id,
        message: `\`## ${id}\` 절이 ${found.length}개임: 항목마다 하나`,
      })
    }
  }
  const seen = new Set<string>()
  for (const s of sections) {
    if (!replyItems.includes(s.id)) {
      if (!seen.has(s.id)) {
        errors.push({
          file,
          part: 'body',
          field: s.id,
          message: `\`## ${s.id}\`: 이번 라운드의 코멘트 항목이 아님 (항목: ${replyItems.join(', ') || '없음'})`,
        })
      }
    } else if (!s.body.trim() && !seen.has(s.id)) {
      errors.push({ file, part: 'body', field: s.id, message: `\`## ${s.id}\`의 답글이 비어 있음` })
    }
    seen.add(s.id)
  }
  return errors
}

// ---------- task 검사 ----------

export interface TaskCheckInput {
  node: TaskNode
  /** Work의 업무 유형 (D232). recommended_next.node의 허용값을 정한다 */
  type: WorkType
  /** task 디렉터리 바로 아래의 .md 파일. 이름 → 내용 */
  files: Readonly<Record<string, string>>
  config: Pick<AppConfig, 'handoff_body_warn_chars' | 'intent_warn_chars'>
  /** 형식 버전 (5.2.1). 기본은 FORMAT_VERSION */
  formatVersion?: number
  /** PR 대응 task: 이번 라운드의 코멘트 항목 id. replies.md를 검사한다 (D190) */
  replyItems?: readonly string[]
  /**
   * 지식 관리가 켜진 verify의 지식 확인 결과 (core/knowledge knowledgeIssues, D291, D293, D294). 앱이 worktree를 읽어 만든다.
   * 끄면 없다
   */
  knowledgeIssues?: readonly FormatIssue[]
}

export interface TaskCheck extends CheckSummary {
  /** handoff.md 자신에 오류가 없을 때의 머리글. 산출물 쪽 오류는 따지지 않는다 */
  handoff: Handoff | null
  /**
   * handoff.md 머리글이 스키마를 통과했을 때의 값. 본문이나 추가 검사의 오류가 있어도 채운다.
   * [오류 무시하고 승인]이 결정과 이전 단계 추천을 읽는 데 쓴다 (D112)
   */
  handoffHeader: Handoff | null
}

/**
 * task 디렉터리 검사 (5.2.1). 파일이 있으면 그 파일의 검사를 하고,
 * 필수 산출물(3.1)은 handoff가 awaiting_approval일 때만 확인한다 (D30).
 * intake에서 status를 읽지 못하면 intent 초안이 있는지는 확인한다 (D134).
 */
export function checkTask(input: TaskCheckInput): TaskCheck {
  const { node, files, config } = input
  const version = input.formatVersion ?? FORMAT_VERSION
  const draftText = node === 'intake' ? files[INTENT_DRAFT_FILE] : undefined
  const draft =
    draftText === undefined
      ? null
      : checkIntentDraft(draftText, { warnChars: config.intent_warn_chars })
  const handoffText = files[HANDOFF_FILE]
  const handoff =
    handoffText === undefined
      ? null
      : checkHandoff(handoffText, {
          node,
          type: input.type,
          warnChars: config.handoff_body_warn_chars,
          formatVersion: version,
        })

  const errors: FormatIssue[] = [...(handoff?.errors ?? [])]
  if (handoff?.status === 'awaiting_approval') {
    for (const artifact of NODE_INFO[node].artifacts) {
      if (files[artifact] === undefined) {
        errors.push({
          file: artifact,
          part: 'file',
          message: `\`${artifact}\` 없음: \`status: awaiting_approval\`일 때 필수 산출물`,
        })
      }
    }
  } else if (node === 'intake' && handoff && handoff.status === null && draftText === undefined) {
    // status를 읽지 못한 handoff는 [오류 무시하고 승인]할 수 있으므로 초안 없음을 넘길 수 없는 오류로 남긴다 (D134)
    errors.push({
      file: INTENT_DRAFT_FILE,
      part: 'file',
      message: `\`${INTENT_DRAFT_FILE}\` 없음: handoff의 \`status\`를 읽지 못해도 의도 승인에 필요`,
    })
  }
  errors.push(...(draft?.errors ?? []))
  const prText = node === 'verify' ? files[PR_FILE] : undefined
  if (prText !== undefined) errors.push(...checkPr(prText))
  if (input.knowledgeIssues && node === 'verify' && handoff?.status === 'awaiting_approval') {
    errors.push(...input.knowledgeIssues)
  }
  if (node === 'respond') {
    // 파일이 있으면 늘 검사하고, 없으면 마무리할 때(awaiting_approval) 필수다 (D30, D190)
    const replies = files[REPLIES_FILE]
    if (replies !== undefined || handoff?.status === 'awaiting_approval') {
      errors.push(...checkReplies(replies, input.replyItems ?? []))
    }
  }

  return {
    handoff_present: handoffText !== undefined,
    status: handoff?.status ?? null,
    errors,
    warnings: [...(handoff?.warnings ?? []), ...(draft?.warnings ?? [])],
    handoff: handoff?.value ?? null,
    handoffHeader: handoff?.header ?? null,
  }
}

/** 유효한 handoff: handoff가 있고 형식 오류가 없다 (시나리오 3의 "유효한 handoff") */
export function isValid(check: CheckSummary): boolean {
  return check.handoff_present && check.errors.length === 0
}

/** work.json에 남길 검사 결과 */
export function summarize(check: CheckSummary): CheckSummary {
  return {
    handoff_present: check.handoff_present,
    status: check.status,
    errors: check.errors,
    warnings: check.warnings,
  }
}

/**
 * Stop 훅으로 되돌리는 메시지 (D21, D87). 첫 줄은 사람도 읽는 BOUNCE_HEAD다(D220). 파일, 필드, 어긴 규칙을 적는다.
 * 경고는 넣지 않는다
 */
export function bounceMessage(check: CheckSummary): string {
  return [
    BOUNCE_HEAD,
    '형식 검사에서 오류가 나왔습니다. 오류가 가리키는 파일을 고치고 빠진 산출물이나 절을 채운 뒤, ' +
      '종료 절차의 handoff 작성과 안내를 다시 하세요. 결정, 원인, 판정은 바꾸지 마세요.',
    ...check.errors.map((e) => `- ${e.file}: ${e.message}`),
  ].join('\n')
}

/**
 * 되돌림 메시지의 첫 줄 (D220). Claude Code는 Stop 훅의 되돌림을 "Stop hook error: <메시지>"로 터미널에 그리므로
 * 사람도 읽는다고 보고 쓴다
 */
export const BOUNCE_HEAD =
  '[relay 형식 확인] 작업 결과와는 관계없고 handoff와 산출물의 형식만 고칩니다.'
