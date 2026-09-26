// gh CLI (I12). M2는 등록 점검(D67)만 한다. PR은 M5에서 더한다.
import { describeFailure, run } from './exec'

export interface GhStatus {
  ok: boolean
  detail: string
}

/** gh auth status가 성공하는가 (D67). gh가 없으면 실패다 */
export async function ghAuthStatus(bin = 'gh', env?: NodeJS.ProcessEnv): Promise<GhStatus> {
  const r = await run(bin, ['auth', 'status'], { env, timeoutMs: 30_000 })
  if (r.code === 0) return { ok: true, detail: '로그인됨' }
  if (r.code === null && r.error?.includes('ENOENT')) {
    return { ok: false, detail: 'gh가 설치되어 있지 않음' }
  }
  return { ok: false, detail: describeFailure(r) }
}
