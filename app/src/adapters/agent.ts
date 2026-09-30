// CLI 점검과 실행 선택의 경계. Codex 실행은 호환 스파이크 뒤에 연결한다 (docs/engines.md P1~P3).
import type { AgentEngine } from '../shared/agent'
import { AGENT_LABELS } from '../shared/agent'
import {
  cleanupArgs,
  launchArgs,
  resumeArgs,
  type LaunchInput,
  type ResumeInput,
} from '../core/settings'
import { claudeAuthStatus, claudeVersion, deploySkill, findClaude, type AuthStatus } from './claude'

export const CLAUDE_INSTALL_GUIDE =
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
  launchArgs(input: LaunchInput): string[]
  resumeArgs(input: ResumeInput): string[]
  cleanupArgs(settingsPath: string): string[]
}

const claude: AgentRuntime = {
  engine: 'claude',
  label: AGENT_LABELS.claude,
  installGuide: CLAUDE_INSTALL_GUIDE,
  find: (env) => findClaude({ env }),
  version: claudeVersion,
  authStatus: claudeAuthStatus,
  deploySkill,
  launchArgs,
  resumeArgs,
  cleanupArgs,
}

export function agentRuntime(engine: AgentEngine): AgentRuntime {
  if (engine === 'claude') return claude
  // Codex를 Claude로 실행하지 않는다. 단계별 구현 중에도 선택과 실제 실행이 어긋나면 막는다.
  throw new Error(
    `${AGENT_LABELS[engine]} 실행은 호환성 검증 중입니다. 현재는 Claude Code를 선택해 주세요.`,
  )
}
