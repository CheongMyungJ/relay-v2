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

/** git과 gh의 전역 옵션 가운데 값을 다음 낱말로 받는 것 */
const VALUE_OPTIONS: Readonly<Record<'git' | 'gh', readonly string[]>> = {
  git: ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix'],
  gh: ['-R', '--repo', '--hostname'],
}

/**
 * 명령 줄에 `git push`나 `gh pr`이 있는가 (D17). 하위 명령만 본다: 전역 옵션(`git -C <폴더> push`, `gh --repo <레포> pr`)은
 * 건너뛰고, 커밋 메시지나 다른 하위 명령의 인자(`git stash push`, `git log --grep=push`)는 막지 않는다
 */
function pushesOrPr(execution: string): boolean {
  for (const part of execution.split(/[\n;&|]+/)) {
    const words = part.trim().split(/\s+/).filter(Boolean)
    for (let k = 0; k < words.length; k++) {
      const name = (words[k] ?? '')
        .replace(/^.*[\\/]/, '')
        .replace(/\.exe$/i, '')
        .toLowerCase()
      if (name !== 'git' && name !== 'gh') continue
      let n = k + 1
      while (n < words.length && (words[n] ?? '').startsWith('-')) {
        const opt = words[n] ?? ''
        n += VALUE_OPTIONS[name].includes(opt) ? 2 : 1
      }
      const sub = (words[n] ?? '').toLowerCase()
      if ((name === 'git' && sub === 'push') || (name === 'gh' && sub === 'pr')) return true
    }
  }
  return false
}

/** 훅 입력에 명시된 파일·패치·직접 명령을 검사한다. 별도 스크립트/별칭/동적 경로는 완전 통제하지 못한다. */
export function codexToolDenial(
  input: DenyInput & {
    worktree: string
    taskDir?: string
    cwd?: string
    /** 곁 세션: 사람이 허락하면 push와 PR 조작을 한다 (D388, D391) */
    allowPush?: boolean
  },
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
    `${root}/requirements`,
    `${root}/.claude`,
    `${root}/.agents`,
    `${root}/.codex`,
    ...(input.taskDir ? [`${norm(input.taskDir)}/.agents`] : []),
  ]
  const canonical = (s: string, base = input.worktree) => {
    const absolute = /^(?:\/|[A-Za-z]:[\\/])/.test(s) ? norm(s) : `${norm(base)}/${norm(s)}`
    const parts: string[] = []
    for (const p of absolute.split('/')) {
      if (p === '..') {
        // 절대 경로의 루트(드라이브 포함) 위로 올라가지 않는다.
        if (parts.length && !/^[A-Za-z]:$/.test(parts.at(-1) ?? '')) parts.pop()
      } else if (p !== '.' && p !== '') parts.push(p)
    }
    const result = `${absolute.startsWith('/') ? '/' : ''}${parts.join('/')}`
    return /^[A-Za-z]:/.test(result) ? result.toLowerCase() : result
  }
  const workdir =
    [args['workdir'], args['cwd'], input.cwd, input.worktree].find(
      (value): value is string => typeof value === 'string' && value.trim() !== '',
    ) ?? input.worktree
  const workingDir = canonical(workdir, input.cwd ?? input.worktree)
  const within = (p: string, dir: string) => p === dir || p.startsWith(`${dir.replace(/\/$/, '')}/`)
  const protectedPath = (s: string) => {
    const p = canonical(s, workingDir)
    return (
      protectedFiles.some((f) => within(canonical(f), p)) ||
      protectedDirs.some((d) => within(p, canonical(d)) || within(canonical(d), p))
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
  if (!input.allowPush && pushesOrPr(execution))
    return 'push와 PR 조작은 사람이 승인한 뒤 relay 앱이 수행합니다.'

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
    if (shellMutationPaths(execution).some(protectedPath))
      return '명령이 앱 소유 파일이나 이전 task 기록을 변경하려고 합니다.'
    const normalized = norm(execution)
    if ([...protectedFiles, ...protectedDirs].some((p) => normalized.includes(p)))
      return '명령이 앱 소유 파일이나 이전 task 기록을 변경하려고 합니다.'
  }
  return null
}

/** 직접 명령의 리디렉션·파일 조작 인자를 읽는다. 셸 확장이나 외부 스크립트를 실행해 추측하지 않는다. */
function shellMutationPaths(command: string): string[] {
  const tokens = command.match(/"(?:\\.|[^"\\])*"|'[^']*'|\d*>>?\|?|[;|&\n]|[^\s"'<>;|&]+/g) ?? []
  const literal = (token: string) => (/^['"]/.test(token) ? token.slice(1, -1) : token)
  const paths: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? ''
    if (/^\d*>>?\|?$/.test(token)) {
      const target = tokens[i + 1]
      if (target) paths.push(literal(target))
    }
    const name = literal(token).replace(/\\/g, '/').split('/').at(-1) ?? ''
    const mutation =
      /^(?:rm|mv|cp|tee|truncate|Set-Content|Add-Content|Remove-Item|Move-Item)(?:\.exe)?$/i.test(
        name,
      )
    const sed = name === 'sed' && tokens.slice(i + 1).some((t) => /^-i/.test(t))
    if (!mutation && !sed) continue
    for (let j = i + 1; j < tokens.length; j++) {
      const arg = tokens[j] ?? ''
      if (/^[;|&\n]$/.test(arg) || /^\d*>>?/.test(arg)) break
      if (!arg.startsWith('-')) paths.push(literal(arg))
    }
  }
  // 기존 write_text/writeFile/open 보호도 리터럴 상대 경로를 해석한다.
  for (const match of command.matchAll(/(?:\b(?:open|Path|writeFile(?:Sync)?)\(\s*)(['"])(.*?)\1/g))
    if (match[2]) paths.push(match[2])
  return paths
}
