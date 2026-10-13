import { loadFactor } from '../couriers/load.js'

const GAP = 0.2

/**
 * 새 기사가 출근했을 때 정거장을 다시 나눈다. 같은 구역에서 가장 바쁜 기사의 마지막 정거장을 가장 한가한 기사에게
 * 넘기기를 부하 차이가 0.2 미만이 될 때까지 되풀이한다.
 */
export function redistributeStops(couriers) {
  const pool = couriers.map((c) => ({ ...c, stops: [...c.stops] }))
  for (const zone of new Set(pool.map((c) => c.zone))) {
    const group = pool.filter((c) => c.zone === zone)
    for (let guard = 0; guard < 100 && group.length > 1; guard++) {
      group.sort((a, b) => loadFactor(a) - loadFactor(b))
      const [low, high] = [group[0], group[group.length - 1]]
      if (loadFactor(high) - loadFactor(low) < GAP || high.stops.length < 2) break
      low.stops.push(high.stops.pop())
    }
  }
  return pool
}
