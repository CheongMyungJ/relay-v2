// extract run을 띄울 claude 실행 파일. Windows의 npm 설치는 claude.cmd(cmd.exe로 감쌈)인데, cmd.exe는 명령 줄이
// 8,191자에서 막혀 결과 스키마(argv)가 걸린다(requirements-extraction-flow.md 녹화 6). 그래서 claude.cmd 옆의
// node_modules/@anthropic-ai/claude-code/bin/claude.exe를 바로 띄운다(그 shim이 하는 일과 같다). 앱의 run도 같은 규칙을
// 쓴다(AI 결정 46, 구현 때 adapters/claude.ts의 findClaude 옆에 둔다).
import fs from 'node:fs'
import path from 'node:path'

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {NodeJS.Platform} [platform]
 * @param {(f: string) => boolean} [exists]
 */
export function runBin(env = process.env, platform = process.platform, exists = fs.existsSync) {
  if (env.CLAUDE_BIN) return env.CLAUDE_BIN
  if (platform !== 'win32') return 'claude'
  const p = path.win32
  const dirs = (env.PATH ?? env.Path ?? '').split(';').filter(Boolean)
  if (env.USERPROFILE) dirs.unshift(p.join(env.USERPROFILE, '.local', 'bin'))
  for (const dir of dirs) {
    const exe = p.join(dir, 'claude.exe')
    if (exists(exe)) return exe
    if (exists(p.join(dir, 'claude.cmd'))) {
      const inner = p.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
      if (exists(inner)) return inner
    }
  }
  return 'claude'
}
