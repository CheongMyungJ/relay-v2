// 결제사 API (시험에서는 가짜). 금액은 원 단위 정수
export const charges = []

export async function charge(orderId, amount) {
  const id = `ch_${orderId}_${charges.length + 1}`
  charges.push({ id, orderId, amount })
  return { ok: true, chargeId: id }
}
