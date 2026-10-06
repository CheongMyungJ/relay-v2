// env.mjs의 타입. 앱의 TypeScript 시험(test/contract/live.test.ts)이 같은 환경 고르기를 쓴다
export function cleanEnv(extra?: Record<string, string | undefined | null>): NodeJS.ProcessEnv
export function makeClaudeConfig(dir: string): string
export function findClaude(): string
export function agentEnv(o: { agentModel: string; effort: string }): Record<string, string>
