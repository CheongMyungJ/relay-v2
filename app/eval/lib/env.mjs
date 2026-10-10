// 평가에서 띄우는 claude(에이전트, 사람 역할, 판정)와 앱에 넘길 환경.
// 세션의 환경 변수가 넘어가지 않게 필요한 것만 고른다 (spikes/README.md의 Linux 준비, docs/implementation.md 8.4).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PASS = [
  'HOME',
  'PATH',
  'SHELL',
  'USER',
  'LOGNAME',
  'LANG',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'REQUESTS_CA_BUNDLE',
  'DISPLAY',
  'XAUTHORITY',
  // Windows: 설정 폴더(USERPROFILE), 셸과 도구가 기대는 시스템 변수. Linux에는 없어 영향이 없다
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'SystemRoot',
  'SystemDrive',
  'windir',
  'ComSpec',
  'PATHEXT',
  'TEMP',
  'TMP',
  'HOMEDRIVE',
  'HOMEPATH',
  'ProgramFiles',
  'ProgramData',
  'CLAUDE_CODE_GIT_BASH_PATH',
]

/** 고른 변수만 담은 환경. root에서는 IS_SANDBOX=1이 있어야 --dangerously-skip-permissions로 뜬다 */
export function cleanEnv(extra = {}) {
  const env = {}
  for (const k of PASS) if (process.env[k] !== undefined) env[k] = process.env[k]
  env.TERM = 'xterm-256color'
  env.LANG = env.LANG || 'C.UTF-8'
  if (!env.SHELL && process.platform !== 'win32') env.SHELL = '/bin/bash'
  if (process.getuid?.() === 0) env.IS_SANDBOX = '1'
  // 자동 업데이트 알림이 화면에 끼지 않게 한다 (두 쪽 같음)
  env.DISABLE_AUTOUPDATER = '1'
  env.CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION = 'false'
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null) env[k] = String(v)
  return env
}

/**
 * claude 설정 폴더를 만든다. 대화형 온보딩을 건너뛰게 hasCompletedOnboarding만 더한다 (8.4).
 * 에이전트, 사람 역할, 판정이 폴더를 따로 써서 사용량을 나눠 셀 수 있게 한다
 */
export function makeClaudeConfig(dir) {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, '.claude.json')
  const j = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  j.hasCompletedOnboarding = true
  fs.writeFileSync(file, JSON.stringify(j, null, 2))
  // 입력창의 흐린 추천 문구는 화면 글자만 보는 사람 역할이 자기가 친 것으로 착각한다. 두 쪽 모두 끈다
  const settings = path.join(dir, 'settings.json')
  if (!fs.existsSync(settings))
    fs.writeFileSync(settings, JSON.stringify({ promptSuggestionEnabled: false }, null, 2))
  return dir
}

let claudeBin = null
/** PATH의 claude. CLAUDE_BIN이 있으면 그것 */
export function findClaude() {
  if (claudeBin) return claudeBin
  claudeBin =
    process.env.CLAUDE_BIN || execFileSync('bash', ['-lc', 'command -v claude']).toString().trim()
  if (!claudeBin) throw new Error('claude를 찾지 못했습니다. eval/setup.sh를 먼저 돌리세요.')
  return claudeBin
}

/** 에이전트(relay 안의 claude와 맨 CLI의 claude)에 줄 모델과 effort */
export function agentEnv(o) {
  return {
    ANTHROPIC_MODEL: o.agentModel,
    CLAUDE_CODE_EFFORT_LEVEL: o.effort,
  }
}
