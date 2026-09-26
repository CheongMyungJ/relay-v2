// 명령을 보내고 결과를 받는다. IPC가 실패(거부)해도 오류 결과로 바꿔, 누른 버튼이 바쁨 상태로 남지 않게 한다.
export type Failed = { ok: false; error: string }

export async function call<T>(fn: () => Promise<T>): Promise<T | Failed> {
  try {
    return await fn()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
