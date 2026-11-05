// 요약 한 통을 가리는 키. 발송 기록에 이 키로 남기고, 같은 키로 이미 보냈으면 다시 보내지 않는다.

/**
 * @param {{ userId: string, period: string, runId: string }} job
 */
export function digestKey({ userId, period, runId }) {
  // 실행마다 따로 남겨야 운영 화면에서 실행별로 몇 통 보냈는지 셀 수 있다
  return `digest:${period}:${runId}:${userId}`
}
