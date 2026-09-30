import { NotFoundError } from '../util/errors.js'

/**
 * 창고 목록. priority가 작을수록 먼저 쓴다(지역이 맞는 창고가 없을 때).
 * 서울은 본사 창고이고, 부산은 2025년에 남부 배송용으로 열었다.
 */
export const WAREHOUSES = Object.freeze([
  {
    code: 'seoul',
    name: '서울',
    priority: 1,
    regions: ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종'],
  },
  {
    code: 'busan',
    name: '부산',
    priority: 2,
    regions: ['부산', '울산', '경남', '대구', '경북', '전북', '전남', '광주', '제주'],
  },
])

export const HOME_WAREHOUSE = 'seoul'

export function warehouse(code) {
  const w = WAREHOUSES.find((x) => x.code === code)
  if (!w) throw new NotFoundError(`없는 창고: ${code}`)
  return w
}

export function isWarehouse(code) {
  return WAREHOUSES.some((x) => x.code === code)
}

export function warehouseName(code) {
  return isWarehouse(code) ? warehouse(code).name : code
}

/** 창고 코드를 목록 순서(우선순위)로 비교 */
export function compareWarehouse(a, b) {
  const pa = isWarehouse(a) ? warehouse(a).priority : 99
  const pb = isWarehouse(b) ? warehouse(b).priority : 99
  return pa - pb || a.localeCompare(b)
}
