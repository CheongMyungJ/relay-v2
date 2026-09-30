// Codex의 CLI 설정과 도구 훅 보호. Claude deny와 같이 실수 방지용이며 샌드박스의 대체가 아니다.
import type { SkillName } from '../shared/config'
import type { DenyInput } from './settings'

export const CODEX_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PermissionRequest',
  'Stop',
  'Interrupt',
  'SessionEnd',
] as const
export type CodexHookEvent = (typeof CODEX_HOOK_EVENTS)[number]

/** TOML inline table serializer. JSON 객체는 TOML table이 아니므로 그대로 -c에 넘기지 않는다. */
export function tomlValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
    return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`
  if (typeof value === 'object' && value !== null)
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)} = ${tomlValue(v)}`)
      .join(', ')} }`
  throw new Error('Codex 설정에 지원하지 않는 값이 있습니다.')
}

export function codexFirstPrompt(skill: SkillName, skillPath: string, contextPath: string): string {
  return `relay-${skill} task를 시작합니다. 먼저 스킬 ${JSON.stringify(skillPath)}와 컨텍스트 ${JSON.stringify(contextPath)}를 읽고 그 절차만 따르세요. 질문은 relay MCP의 ask_human 도구로 묻고 답을 기다리세요.`
}

/** 훅 입력에 명시된 파일·패치·직접 명령을 검사한다. 별도 스크립트/별칭/동적 경로는 완전 통제하지 못한다. */
export function codexToolDenial(
  input: DenyInput & { worktree: string; taskDir?: string },
  tool: string,
  args: Readonly<Record<string, unknown>>,
): string | null {
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '')
  const root = norm(input.workDir)
  const protectedFiles = [
    'work.json',
    'request.md',
    'intent.md',
    'decisions.md',
    'pr-items.json',
  ].map((f) => `${root}/${f}`)
  if (input.taskDir)
    protectedFiles.push(
      ...['context.md', 'task.settings.json', 'pty.log'].map(
        (f) => `${norm(input.taskDir ?? '')}/${f}`,
      ),
    )
  const protectedDirs = [
    ...input.previousTaskDirs.map(norm),
    `${root}/.claude`,
    `${root}/.agents`,
    `${root}/.codex`,
    ...(input.taskDir ? [`${norm(input.taskDir)}/.agents`] : []),
  ]
  const canonical = (s: string) => {
    const absolute = /^(?:\/|[A-Za-z]:[\\/])/.test(s)
      ? norm(s)
      : `${norm(input.worktree)}/${norm(s)}`
    const parts: string[] = []
    for (const p of absolute.split('/')) {
      if (p === '..') parts.pop()
      else if (p !== '.') parts.push(p)
    }
    const result = parts.join('/')
    return /^[A-Za-z]:/.test(result) ? result.toLowerCase() : result
  }
  const protectedPath = (s: string) => {
    const p = canonical(s)
    return (
      protectedFiles.some((f) => p === canonical(f)) ||
      protectedDirs.some((d) => p === canonical(d) || p.startsWith(`${canonical(d)}/`))
    )
  }
  const command = [args['command'], args['cmd'], args['patch'], args['input']]
    .filter((x): x is string => typeof x === 'string')
    .join('\n')
  const execution = /bash|shell|exec|terminal/i.test(tool)
    ? [args['command'], args['cmd'], args['input']]
        .filter((x): x is string => typeof x === 'string')
        .join('\n')
    : ''
  if (/\bgit(?:\.exe)?\b[^\n;&|]*\bpush\b|\bgh(?:\.exe)?\b[^\n;&|]*\bpr\b/i.test(execution)) {
    return 'push와 PR 조작은 사람이 승인한 뒤 relay 앱이 수행합니다.'
  }
  const paths: string[] = []
  if (/write|edit|patch/i.test(tool)) {
    for (const key of ['file_path', 'path', 'file'])
      if (typeof args[key] === 'string') paths.push(args[key])
  }
  for (const match of command.matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gm))
    if (match[1]) paths.push(match[1])
  for (const match of command.matchAll(/^\*\*\* Move to:\s*(.+)$/gm))
    if (match[1]) paths.push(match[1])
  if (paths.some(protectedPath)) return '앱 소유 파일이나 이전 task 기록은 편집할 수 없습니다.'
  if (
    /(?:\b(?:rm|mv|cp|tee|truncate|Set-Content|Add-Content|Remove-Item|Move-Item)\b|\bsed\b[^\n]*\s-i\b|write_text|writeFile|open\([^\n]*['"](?:w|a)['"]|(?:^|[^<])>)/i.test(
      execution,
    )
  ) {
    const normalized = norm(execution)
    if ([...protectedFiles, ...protectedDirs].some((p) => normalized.includes(p)))
      return '명령이 앱 소유 파일이나 이전 task 기록을 변경하려고 합니다.'
  }
  return null
}
