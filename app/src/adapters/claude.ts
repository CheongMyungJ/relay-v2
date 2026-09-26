// claude 실행 파일 찾기 (D106).
// 출처: spikes/lib/session.mjs resolveClaude. 스파이크는 못 찾으면 'claude'를 돌려줬지만,
// 앱은 PATH를 직접 뒤지고 못 찾으면 null을 돌려준다 (D106: 못 찾으면 등록을 막는다).
import fs from 'node:fs'
import path from 'node:path'

export interface FindClaudeOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  exists?: (file: string) => boolean
}

export function findClaude(opts: FindClaudeOptions = {}): string | null {
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const exists = opts.exists ?? ((f: string) => fs.existsSync(f))
  const p = platform === 'win32' ? path.win32 : path.posix

  if (env['CLAUDE_BIN']) return env['CLAUDE_BIN']

  const candidates: string[] = []
  if (platform === 'win32') {
    if (env['USERPROFILE'])
      candidates.push(p.join(env['USERPROFILE'], '.local', 'bin', 'claude.exe'))
    if (env['APPDATA']) candidates.push(p.join(env['APPDATA'], 'npm', 'claude.cmd'))
  }
  const names = platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude']
  // Windows는 환경 변수 이름의 대소문자를 가리지 않는다.
  const pathVar = env['PATH'] ?? env['Path'] ?? ''
  for (const dir of pathVar.split(platform === 'win32' ? ';' : ':')) {
    if (!dir) continue
    for (const n of names) candidates.push(p.join(dir, n))
  }
  return candidates.find(exists) ?? null
}
