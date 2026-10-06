// CLI 점검·스킬·설정·실행 선택의 경계 (docs/engines.md).
import type { AgentEngine } from '../shared/agent'
import { AGENT_LABELS } from '../shared/agent'
import {
  cleanupArgs,
  launchArgs,
  resumeArgs,
  launchEnv,
  taskSettings,
  type TaskSettingsInput,
  type TaskSettings,
  type LaunchInput,
  type ResumeInput,
} from '../core/settings'
import { claudeAuthStatus, claudeVersion, deploySkill, findClaude, type AuthStatus } from './claude'
import type { SkillName } from '../shared/config'
import {
  CODEX_INSTALL_GUIDE,
  codexAuthStatus,
  codexCleanupArgs,
  codexLaunchArgs,
  codexLaunchEnv,
  codexResumeArgs,
  codexSettings,
  codexVersion,
  deployCodexSkill,
  findCodex,
  type CodexSettings,
} from './codex'

const CLAUDE_INSTALL_GUIDE =
  'claude 실행 파일을 찾지 못했습니다. Claude Code를 설치하세요' +
  ' (PowerShell: irm https://claude.ai/install.ps1 | iex, 안내: https://code.claude.com/docs/en/setup).' +
  ' 다른 위치에 설치했다면 CLAUDE_BIN 환경 변수로 경로를 알려 주세요.'

/** 실행 파일/버전/인증과 실행 인자를 한 엔진에 묶어 다른 엔진으로의 묵시적 대체를 막는다. */
export interface AgentRuntime {
  engine: AgentEngine
  label: string
  installGuide: string
  find(env: NodeJS.ProcessEnv): string | null
  version(bin: string, env: NodeJS.ProcessEnv): Promise<string>
  authStatus(bin: string, env: NodeJS.ProcessEnv): Promise<AuthStatus>
  deploySkill: typeof deploySkill
  settings(input: AgentSettingsInput): TaskSettings | CodexSettings
  launchEnv(token: string, port: number, taskId: string): Record<string, string>
  launchArgs(input: LaunchInput): string[] | Promise<string[]>
  resumeArgs(input: ResumeInput): string[] | Promise<string[]>
  cleanupArgs(settingsPath: string): string[] | Promise<string[]>
}

export interface AgentSettingsInput extends TaskSettingsInput {
  taskDir?: string
  skill?: SkillName
  /** task에 고정한 모델·추론 수준. Codex는 설정 덮어쓰기로 넘긴다 */
  model?: string
  effort?: string
}

const claude: AgentRuntime = {
  engine: 'claude',
  label: AGENT_LABELS.claude,
  installGuide: CLAUDE_INSTALL_GUIDE,
  find: (env) => findClaude({ env }),
  version: claudeVersion,
  authStatus: claudeAuthStatus,
  deploySkill,
  settings: taskSettings,
  launchEnv,
  launchArgs,
  resumeArgs,
  cleanupArgs,
}

const codex: AgentRuntime = {
  engine: 'codex',
  label: AGENT_LABELS.codex,
  installGuide: CODEX_INSTALL_GUIDE,
  find: (env) => findCodex({ env }),
  version: codexVersion,
  authStatus: codexAuthStatus,
  deploySkill: deployCodexSkill,
  settings: codexSettings,
  launchEnv: codexLaunchEnv,
  launchArgs: codexLaunchArgs,
  resumeArgs: codexResumeArgs,
  cleanupArgs: codexCleanupArgs,
}

export function agentRuntime(engine: AgentEngine): AgentRuntime {
  if (engine === 'claude') return claude
  if (engine === 'codex') return codex
  throw new Error(`지원하지 않는 엔진: ${String(engine)}`)
}
