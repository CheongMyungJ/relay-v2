// 유형의 정의 검사 (5.6.13, 5.6.15, D449, D453, D457, D506~D514, I162). type.json의 글을 받아 CustomTypeDef나 사람이 읽는
// 오류 목록을 돌려준다. 기본 유형(skills/types/)과 커스텀 유형이 같은 형식이다. 파일 읽기와 전역·레포 합치기는
// adapters/custom-types가 한다
import { QUESTION_MODES, type QuestionMode } from '../shared/config'
import { WORK_TYPES, type CustomStep, type CustomTypeDef, type TypeTarget } from '../shared/work'

/** 유형 폴더의 정의 파일 */
export const TYPE_FILE = 'type.json'
/** 유형 폴더의 선택 파일 (D456, D507): 의도 정리 지시, 독립 리뷰 관점, 마무리 판정 규칙, PR 템플릿 */
export const INTAKE_NOTES_FILE = 'intake.md'
export const VERIFY_NOTES_FILE = 'verify.md'
export const FINISH_NOTES_FILE = 'finish.md'
export const PR_TEMPLATE_FILE = 'pr-template.md'
/** 유형 단위 칸의 파일. 이 차례로 복사하고 쓴다 */
export const TYPE_NOTE_FILES = [
  INTAKE_NOTES_FILE,
  VERIFY_NOTES_FILE,
  FINISH_NOTES_FILE,
  PR_TEMPLATE_FILE,
] as const

/** 지금 쓰는 type.json 판 (D506) */
export const SCHEMA_VERSION = 2

/** 유형이 다루는 대상 (D510) */
export const TYPE_TARGETS: readonly TypeTarget[] = ['code', 'document']

/** 유형 id와 단계 id의 모양 (D449): 영어 소문자·숫자이고 `-`로 잇는다 */
export const CUSTOM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 유형 id와 단계 id의 최대 글자 수. task 디렉터리·산출물·브랜치 이름이 된다 */
export const ID_MAX = 40

/** 유형 id로 쓸 수 없는 이름: 기본 유형과 custom (D449) */
export const RESERVED_TYPE_IDS: readonly string[] = [...WORK_TYPES, 'custom']

/**
 * 단계 id로 쓸 수 없는 이름 (D449, D514): 유형 폴더의 칸 파일(intake.md·verify.md·finish.md·pr-template.md)과 type 폴더,
 * task 디렉터리에서 앱과 에이전트가 쓰는 파일 이름. 마지막 단계의 task 디렉터리에는 판정표·PR 초안·독립 리뷰 결과도 놓인다.
 * 단계 id는 task 디렉터리의 산출물 <id>.md가 된다 (D453). 기본 유형의 단계 이름(fix, design 등)은 쓸 수 있다
 */
export const RESERVED_STEP_IDS: readonly string[] = [
  'intake',
  'verify',
  'finish',
  'pr-template',
  'verification',
  'pr',
  'independent-review',
  'handoff',
  'context',
  'instructions',
  'knowledge-injected',
  'type',
]

/** 이름과 단계 이름의 최대 글자 수 */
const NAME_MAX = 40

export type CustomTypeCheck = { ok: true; def: CustomTypeDef } | { ok: false; errors: string[] }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** 유형 id(폴더 이름)의 오류. 쓸 수 있으면 null이다 */
export function typeIdError(id: string): string | null {
  if (!CUSTOM_ID.test(id)) return `유형 id \`${id}\`: 영어 소문자·숫자·\`-\`만 씀`
  if (id.length > ID_MAX) return `유형 id \`${id}\`: ${ID_MAX}자를 넘음`
  if (RESERVED_TYPE_IDS.includes(id)) return `유형 id \`${id}\`: 기본 유형 이름과 겹침`
  return null
}

/** 단계 id의 오류. 쓸 수 있으면 null이다 */
export function stepIdError(id: string): string | null {
  if (!CUSTOM_ID.test(id)) return `단계 id \`${id}\`: 영어 소문자·숫자·\`-\`만 씀`
  if (id.length > ID_MAX) return `단계 id \`${id}\`: ${ID_MAX}자를 넘음`
  if (RESERVED_STEP_IDS.includes(id)) return `단계 id \`${id}\`: 앱이 쓰는 이름과 겹침`
  return null
}

function checkStep(v: unknown, i: number, errors: string[]): CustomStep | null {
  const at = `steps[${i}]`
  if (!isRecord(v)) {
    errors.push(`${at}: 객체여야 함`)
    return null
  }
  const id = typeof v['id'] === 'string' ? v['id'] : ''
  const idError = id ? stepIdError(id) : `${at}.id: 없음`
  if (idError) errors.push(idError)
  const title = typeof v['title'] === 'string' ? v['title'].trim() : ''
  if (!title) errors.push(`${at}.title: 단계 이름이 없음`)
  else if ([...title].length > NAME_MAX) errors.push(`${at}.title: ${NAME_MAX}자를 넘음`)
  const raw = v['sections'] ?? []
  const sections: string[] = []
  if (!Array.isArray(raw)) errors.push(`${at}.sections: 목록이어야 함`)
  else {
    for (const s of raw) {
      const name = typeof s === 'string' ? s.trim() : ''
      if (!name) errors.push(`${at}.sections: 빈 절 이름`)
      else if (/[\r\n]/.test(name) || name.startsWith('#'))
        errors.push(`${at}.sections: 절 이름 \`${name}\`에 줄바꿈이나 #이 있음`)
      else if (sections.includes(name)) errors.push(`${at}.sections: \`${name}\`이 두 번 있음`)
      else sections.push(name)
    }
  }
  const auto = v['auto_approve'] ?? false
  if (typeof auto !== 'boolean') errors.push(`${at}.auto_approve: true/false여야 함`)
  const rawLead = v['lead'] ?? []
  const lead: string[] = []
  if (!Array.isArray(rawLead)) errors.push(`${at}.lead: 목록이어야 함`)
  else {
    for (const s of rawLead) {
      const name = typeof s === 'string' ? s.trim() : ''
      if (!name || !sections.includes(name))
        errors.push(`${at}.lead: \`${String(s)}\`은 sections에 없는 절`)
      else if (!lead.includes(name)) lead.push(name)
    }
  }
  const mode = v['question_mode'] ?? null
  if (mode !== null && !(QUESTION_MODES as readonly unknown[]).includes(mode))
    errors.push(`${at}.question_mode: ${QUESTION_MODES.join(' | ')} 또는 null이어야 함`)
  const base = v['step_base'] ?? true
  if (typeof base !== 'boolean') errors.push(`${at}.step_base: true/false여야 함`)
  if (idError || !title) return null
  return {
    id,
    title,
    sections,
    auto_approve: auto === true,
    lead,
    question_mode: (mode as QuestionMode | null) ?? null,
    step_base: base !== false,
  }
}

/** 글 설정 하나. 없으면 빈 글이고, 글이 아니거나 너무 길면 오류다 */
function optionalText(data: Record<string, unknown>, key: string, errors: string[]): string {
  const v = data[key] ?? ''
  if (typeof v !== 'string') {
    errors.push(`${key}: 글이어야 함`)
    return ''
  }
  return v.trim()
}

/**
 * type.json 검사 (D449, D453, D457, D506~D511). id는 폴더 이름이다. 이름이 있어야 하고 단계가 하나 이상이며 단계 id가 서로
 * 달라야 한다. sections를 비우면 기본 두 절(core/pipeline customSections), auto_approve를 비우면 끔이다. schema_version 1(D506
 * 전의 커스텀 유형)은 확인 방법을 켠 코드 유형으로 읽고(D509), 2는 비운 check_method를 끔으로 읽는다
 */
export function parseCustomType(id: string, text: string): CustomTypeCheck {
  const errors: string[] = []
  const idError = typeIdError(id)
  if (idError) errors.push(idError)
  return parseDef(id, text, errors)
}

/** 기본 유형의 type.json 검사 (D506): id가 기본 유형 이름이어야 한다. 나머지 규칙은 커스텀과 같다 */
export function parseBuiltinType(id: string, text: string): CustomTypeCheck {
  const errors: string[] = []
  if (!(WORK_TYPES as readonly string[]).includes(id)) errors.push(`기본 유형이 아님: ${id}`)
  return parseDef(id, text, errors)
}

function parseDef(id: string, text: string, errors: string[]): CustomTypeCheck {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [...errors, `${TYPE_FILE}: JSON이 아님 (${String(e)})`] }
  }
  if (!isRecord(data)) return { ok: false, errors: [...errors, `${TYPE_FILE}: 객체여야 함`] }
  const version = data['schema_version'] ?? 1
  if (version !== 1 && version !== SCHEMA_VERSION)
    errors.push(`schema_version: 1이나 ${SCHEMA_VERSION}이어야 함`)
  const name = typeof data['name'] === 'string' ? data['name'].trim() : ''
  if (!name) errors.push('name: 유형 이름이 없음')
  else if ([...name].length > NAME_MAX) errors.push(`name: ${NAME_MAX}자를 넘음`)
  const description = optionalText(data, 'description', errors)
  const requestHint = optionalText(data, 'request_hint', errors)
  const branchPrefix = optionalText(data, 'branch_prefix', errors)
  if (branchPrefix && (!CUSTOM_ID.test(branchPrefix) || branchPrefix.length > ID_MAX))
    errors.push(`branch_prefix: 영어 소문자·숫자·\`-\`로 ${ID_MAX}자까지`)
  const check = data['check_method'] ?? version === 1
  if (typeof check !== 'boolean') errors.push('check_method: true/false여야 함')
  const target = data['target'] ?? 'code'
  if (!(TYPE_TARGETS as readonly unknown[]).includes(target))
    errors.push(`target: ${TYPE_TARGETS.join(' | ')} 중 하나여야 함`)
  const rawSteps = data['steps']
  const steps: CustomStep[] = []
  if (!Array.isArray(rawSteps) || rawSteps.length === 0)
    errors.push('steps: 단계가 하나 이상 있어야 함')
  else {
    rawSteps.forEach((v, i) => {
      const step = checkStep(v, i, errors)
      if (!step) return
      if (steps.some((s) => s.id === step.id)) errors.push(`단계 id \`${step.id}\`가 두 번 있음`)
      else steps.push(step)
    })
  }
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    def: {
      id,
      name,
      description,
      steps,
      request_hint: requestHint,
      branch_prefix: branchPrefix,
      check_method: check === true,
      target: target as TypeTarget,
    },
  }
}

/** 정의를 type.json 글로 쓴다 (2판). 기본값(빈 절, 끈 자동 승인 등)도 적어 사람이 고칠 자리를 본다 */
export function serializeCustomType(def: CustomTypeDef): string {
  const body = {
    schema_version: SCHEMA_VERSION,
    name: def.name,
    description: def.description,
    request_hint: def.request_hint ?? '',
    branch_prefix: def.branch_prefix ?? '',
    check_method: checkMethodOf(def),
    target: targetOf(def),
    steps: def.steps.map((s) => ({
      id: s.id,
      title: s.title,
      sections: s.sections,
      lead: s.lead ?? [],
      question_mode: s.question_mode ?? null,
      auto_approve: s.auto_approve,
      step_base: s.step_base !== false,
    })),
  }
  return `${JSON.stringify(body, null, 2)}\n`
}

/** 정의의 확인 방법 설정 (D509). 값이 없는 옛 기록(schema_version 1의 복사본)은 켬이다 */
export const checkMethodOf = (def: Pick<CustomTypeDef, 'check_method'>): boolean =>
  def.check_method ?? true

/** 정의의 대상 (D510). 값이 없으면 code다 */
export const targetOf = (def: Pick<CustomTypeDef, 'target'>): TypeTarget => def.target ?? 'code'

/** 정의가 요구하는 파일 중 없는 것의 오류: 단계마다 절차 파일 <단계 id>.md (D449) */
export function missingProcedures(def: CustomTypeDef, files: readonly string[]): string[] {
  return def.steps
    .filter((s) => !files.includes(`${s.id}.md`))
    .map((s) => `\`${s.id}.md\` 없음: 단계 \`${s.id}\`(${s.title})의 절차 파일`)
}

/** 칸의 글이 가리켜도 되는, 앱과 에이전트가 쓰는 파일 (D513) */
const APP_FILES: readonly string[] = [
  'request.md',
  'intent.md',
  'intent.draft.md',
  'context.md',
  'handoff.md',
  'decisions.md',
  'instructions.md',
  'verification.md',
  'pr.md',
  'independent-review.md',
  'response.md',
  'replies.md',
]

/** 백틱으로 감싼 산출물 모양의 이름: 영어 소문자로 시작하고 경로가 없다 */
const ARTIFACT_REF = /`([a-z0-9][a-z0-9.-]*\.md)`/g

/**
 * 저장할 때의 산출물 참조 경고 (D513): 단계 절차와 유형 단위 칸의 글이 가리키는 `<이름>.md`가 이 유형의 단계 산출물(`<단계
 * id>.md`)도, 앱이 쓰는 파일도 아니면 경고한다. 막지 않는다. 기반 단계를 다른 유형에 더하거나 단계 id를 바꾸면 생긴다
 */
export function referenceWarnings(
  def: Pick<CustomTypeDef, 'steps'>,
  texts: readonly { where: string; text: string }[],
): string[] {
  const known = new Set([...APP_FILES, ...def.steps.map((s) => `${s.id}.md`)])
  const out: string[] = []
  for (const { where, text } of texts) {
    const missing = [...new Set([...text.matchAll(ARTIFACT_REF)].map((m) => m[1] ?? ''))].filter(
      (name) => name && !known.has(name),
    )
    for (const name of missing)
      out.push(`${where}: \`${name}\`을 가리키지만 이 유형에 그 산출물을 쓰는 단계가 없음`)
  }
  return out
}
