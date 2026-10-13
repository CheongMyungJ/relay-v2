import { ZONE_SPLIT_LAT } from '../config.js'

/** 주소의 구역: 경계 위도 이상이면 'A'(북), 아니면 'B'(남) */
export function zoneOf(lat, _lng) {
  return lat >= ZONE_SPLIT_LAT ? 'A' : 'B'
}
