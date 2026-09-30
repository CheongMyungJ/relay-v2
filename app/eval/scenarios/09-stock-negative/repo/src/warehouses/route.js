import { WAREHOUSES } from './registry.js'

/** '부산광역시', '경상남도' 같은 표기를 registry의 짧은 이름으로 */
const ALIASES = {
  서울특별시: '서울',
  부산광역시: '부산',
  인천광역시: '인천',
  대구광역시: '대구',
  대전광역시: '대전',
  광주광역시: '광주',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원도: '강원',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전라북도: '전북',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
}

export function normalizeRegion(region) {
  const r = String(region ?? '').trim()
  return ALIASES[r] ?? r
}

/**
 * 배송 지역에서 재고를 찾을 창고 순서.
 * 지역을 맡은 창고가 먼저이고, 나머지는 우선순위 순이다.
 */
export function routeFor(region) {
  const r = normalizeRegion(region)
  const byPriority = [...WAREHOUSES].sort((a, b) => a.priority - b.priority)
  const local = byPriority.filter((w) => w.regions.includes(r))
  const rest = byPriority.filter((w) => !w.regions.includes(r))
  return [...local, ...rest].map((w) => w.code)
}
