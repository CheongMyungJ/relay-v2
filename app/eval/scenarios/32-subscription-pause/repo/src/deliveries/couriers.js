// 지역마다 맡는 택배사. 주소의 첫 낱말(시·도)로 고른다
const BY_REGION = {
  서울: { courier: '새벽배송A', cutoff: '18:00' },
  경기: { courier: '새벽배송A', cutoff: '17:00' },
  인천: { courier: '일반택배B', cutoff: '15:00' },
}
const FALLBACK = { courier: '일반택배B', cutoff: '14:00' }

export function courierFor(address) {
  const region = String(address ?? '').trim().split(/\s+/)[0]
  return BY_REGION[region] ?? FALLBACK
}

/** 배송 목록을 택배사별로 묶는다 */
export function groupByCourier(deliveries) {
  const out = {}
  for (const d of deliveries) {
    const { courier } = courierFor(d.address)
    ;(out[courier] ??= []).push(d.subscriptionId)
  }
  return out
}
