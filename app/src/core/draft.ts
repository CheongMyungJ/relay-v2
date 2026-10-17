// Work 초안 (D404, I135): 에이전트가 초안 폴더에 쓰는 Markdown 파일 하나. 만든 곳(DraftSource)과 상관없는 모양이라
// 기본 세션, 곁 세션, Work 마무리가 같은 읽기를 쓴다. 파일을 읽는 것과 폴더를 보는 것은 main이 한다.
import type { ParsedDraft } from '../shared/session'
import { WORK_TYPES, type WorkType } from '../shared/work'

/** 초안 파일 하나의 크기 상한(바이트). 넘으면 형식 오류다 (I135) */
export const DRAFT_MAX_BYTES = 64 * 1024

/** 초안 폴더의 이름 (D402). 만든 곳의 디렉터리 안에 둔다 */
export const DRAFTS_DIR = 'work-drafts'

/** 초안 파일인가: *.md (D404) */
export function isDraftFile(name: string): boolean {
  return /^[^/\\]+\.md$/i.test(name) && !name.startsWith('.')
}

/** 머리 값의 앞뒤 따옴표를 뗀다. 에이전트가 YAML 습관대로 감쌀 수 있다 */
function unquote(v: string): string {
  const m = /^(["'])(.*)\1$/.exec(v)
  return m ? (m[2] ?? '') : v
}

/**
 * 초안을 읽는다 (D404, I135). 머리(front matter)는 첫 줄과 다음 `---` 줄 사이의 `key: value` 줄만 읽고 모르는 키는
 * 무시한다(YAML 라이브러리를 쓰지 않음). `project`는 등록된 프로젝트 id만 받는다. 형식 오류(크기 초과, 머리 없음, 모르는
 * 프로젝트·유형, 빈 요청)는 errors에 모으고, 맞는 칸은 그대로 돌려줘 화면이 맞는 칸만 채워 열 수 있게 한다. bytes는 파일의
 * 바이트 수다(읽은 쪽이 안다). 글을 다시 인코딩해 세면 깨진 바이트가 U+FFFD(3바이트)로 늘어 작은 파일도 넘친다
 */
export function parseDraft(
  text: string,
  projects: readonly string[],
  bytes = new TextEncoder().encode(text).length,
): ParsedDraft {
  const out: ParsedDraft = { project: null, type: null, base: null, request: '', errors: [] }
  if (bytes > DRAFT_MAX_BYTES) {
    out.errors.push(`파일이 ${DRAFT_MAX_BYTES / 1024}KB를 넘음`)
    return out
  }
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const end =
    lines[0]?.trim() === '---' ? lines.findIndex((l, i) => i > 0 && l.trim() === '---') : -1
  if (end < 0) {
    out.errors.push('머리(--- 사이의 project, type)가 없음')
    out.request = lines.join('\n').trim()
    if (!out.request) out.errors.push('요청(본문)이 비어 있음')
    return out
  }
  const head = new Map<string, string>()
  for (const line of lines.slice(1, end)) {
    const m = /^\s*([A-Za-z_]+)\s*:\s*(.*?)\s*$/.exec(line)
    if (m?.[1] && !head.has(m[1])) head.set(m[1], unquote(m[2] ?? ''))
  }
  const project = head.get('project') ?? ''
  if (!project) out.errors.push('project(프로젝트 id)가 없음')
  else if (projects.includes(project)) out.project = project
  else out.errors.push(`모르는 프로젝트: ${project}`)
  const type = head.get('type') ?? ''
  if (!type) out.errors.push(`type(${WORK_TYPES.join(' | ')})이 없음`)
  else if ((WORK_TYPES as readonly string[]).includes(type)) out.type = type as WorkType
  else out.errors.push(`모르는 유형: ${type} (${WORK_TYPES.join(' | ')} 중 하나)`)
  const base = head.get('base') ?? ''
  if (base) out.base = base
  out.request = lines
    .slice(end + 1)
    .join('\n')
    .trim()
  if (!out.request) out.errors.push('요청(본문)이 비어 있음')
  return out
}
