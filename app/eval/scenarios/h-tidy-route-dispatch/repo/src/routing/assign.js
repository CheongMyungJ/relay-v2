import { loadFactor } from '../couriers/load.js'
import { priorityOf } from '../orders/priority.js'
import { zoneOf } from '../geo/zones.js'

/**
 * 주문을 기사에게 나눈다. 주문은 priorityOf 순서(같으면 id 순)로 하나씩 처리하고, 같은 구역에서 부하가 가장 낮은 기사에게
 * 준다(같으면 기사 id가 작은 쪽). 부하가 1 이상인 기사는 새 주문을 받지 않는다. 줄 기사가 없으면 unassigned에 둔다.
 */
export function assignOrders(orders, couriers) {
  const pool = couriers.map((c) => ({ ...c, stops: [...c.stops] }))
  const unassigned = []
  const sorted = [...orders].sort((a, b) => priorityOf(a) - priorityOf(b) || a.id.localeCompare(b.id))
  for (const order of sorted) {
    const zone = zoneOf(order.lat, order.lng)
    const open = pool
      .filter((c) => c.zone === zone && loadFactor(c) < 1)
      .sort((a, b) => loadFactor(a) - loadFactor(b) || a.id.localeCompare(b.id))
    if (open.length === 0) unassigned.push(order)
    else open[0].stops.push(order)
  }
  return { couriers: pool, unassigned }
}
