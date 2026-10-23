// 커스텀 유형의 정의 검사 (5.6.13, D449, D453, D457, I162). type.json의 글을 받아 CustomTypeDef나 사람이 읽는 오류 목록을
// 돌려준다. 파일 읽기와 전역·레포 합치기는 adapters/custom-types가 한다
import { WORK_TYPES, type CustomStep, type CustomTypeDef } from '../shared/work'
import { NODE_INFO } from './pipeline'

/** 유형 폴더의 정의 파일 */
export const TYPE_FILE = 'type.json'
/** 유형 폴더의 선택 파일: intake 지시와 리뷰 관점 (D456) */
export const INTAKE_NOTES_FILE = 'intake.md'
export const VERIFY_NOTES_FILE = 'verify.md'

/** 유형 id와 단계 id의 모양 (D449): 영어 소문자·숫자이고 `-`로 잇는다 */
export const CUSTOM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 유형 id와 단계 id의 최대 글자 수. task 디렉터리·산출물·브랜치 이름이 된다 */
export const ID_MAX = 40

/** 유형 id로 쓸 수 없는 이름: 기본 유형과 custom (D449) */
export const RESERVED_TYPE_IDS: readonly string[] = [...WORK_TYPES, 'custom']

/**
 * 단계 id로 쓸 수 없는 이름 (D449): 기본 노드(intake.md·verify.md와도 겹친다)와, task 디렉터리에서 앱과 에이전트가 쓰는 파일
 * 이름. 단계 id는 task 디렉터리의 산출물 <id>.md가 된다 (D453)
 */
export const RESERVED_STEP_IDS: readonly string[] = [
  ...Object.keys(NODE_INFO),
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
  if (idError || !title) return null
  return { id, title, sections, auto_approve: auto === true }
}

/**
 * type.json 검사 (D449, D453, D457). id는 폴더 이름이다. 이름이 있어야 하고 단계가 하나 이상이며 단계 id가 서로 달라야 한다.
 * sections를 비우면 기본 두 절(core/pipeline customSections), auto_approve를 비우면 끔이다
 */
export function parseCustomType(id: string, text: string): CustomTypeCheck {
  const errors: string[] = []
  const idError = typeIdError(id)
  if (idError) errors.push(idError)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [...errors, `${TYPE_FILE}: JSON이 아님 (${String(e)})`] }
  }
  if (!isRecord(data)) return { ok: false, errors: [...errors, `${TYPE_FILE}: 객체여야 함`] }
  if (data['schema_version'] !== undefined && data['schema_version'] !== 1)
    errors.push(`schema_version: 1이어야 함`)
  const name = typeof data['name'] === 'string' ? data['name'].trim() : ''
  if (!name) errors.push('name: 유형 이름이 없음')
  else if ([...name].length > NAME_MAX) errors.push(`name: ${NAME_MAX}자를 넘음`)
  const description = data['description'] ?? ''
  if (typeof description !== 'string') errors.push('description: 글이어야 함')
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
      description: typeof description === 'string' ? description.trim() : '',
      steps,
    },
  }
}

/** 정의를 type.json 글로 쓴다. 기본값(빈 절, 끈 자동 승인)도 적어 사람이 고칠 자리를 본다 */
export function serializeCustomType(def: CustomTypeDef): string {
  const body = {
    schema_version: 1,
    name: def.name,
    description: def.description,
    steps: def.steps.map((s) => ({
      id: s.id,
      title: s.title,
      sections: s.sections,
      auto_approve: s.auto_approve,
    })),
  }
  return `${JSON.stringify(body, null, 2)}\n`
}

/** 정의가 요구하는 파일 중 없는 것의 오류: 단계마다 절차 파일 <단계 id>.md (D449) */
export function missingProcedures(def: CustomTypeDef, files: readonly string[]): string[] {
  return def.steps
    .filter((s) => !files.includes(`${s.id}.md`))
    .map((s) => `\`${s.id}.md\` 없음: 단계 \`${s.id}\`(${s.title})의 절차 파일`)
}
