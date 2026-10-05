// 주마다 바뀌는 반찬 차림. 주 번호(1월 1일이 든 주가 0)로 돌린다
const ROTATION = [
  ['멸치볶음', '시금치나물', '장조림', '깍두기', '계란말이', '어묵볶음', '오이무침'],
  ['진미채', '콩나물무침', '제육볶음', '총각김치', '감자조림', '두부조림', '미역줄기'],
  ['우엉조림', '숙주나물', '불고기', '열무김치', '연근조림', '호박볶음', '무생채'],
]

export function weekIndex(date) {
  const [y] = date.split('-').map(Number)
  const start = Date.UTC(y, 0, 1)
  const t = Date.parse(`${date}T00:00:00Z`)
  return Math.floor((t - start) / (7 * 86400000))
}

export function menuFor(date, dishes) {
  const set = ROTATION[weekIndex(date) % ROTATION.length]
  return set.slice(0, dishes)
}
