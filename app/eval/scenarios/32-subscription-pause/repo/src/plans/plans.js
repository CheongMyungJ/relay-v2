import { NotFoundError } from '../util/errors.js'

const PLANS = [
  { id: 'basic-m', name: '기본 반찬 (월간)', period: 'monthly', price: 39000, dishes: 4 },
  { id: 'family-m', name: '가족 반찬 (월간)', period: 'monthly', price: 69000, dishes: 7 },
  { id: 'basic-y', name: '기본 반찬 (연간)', period: 'annual', price: 390000, dishes: 4 },
  { id: 'family-y', name: '가족 반찬 (연간)', period: 'annual', price: 690000, dishes: 7 },
]

export function getPlan(id) {
  const p = PLANS.find((x) => x.id === id)
  if (!p) throw new NotFoundError('플랜', id)
  return p
}

export function listPlans() {
  return [...PLANS]
}

export const PERIOD_LABEL = { monthly: '매월', annual: '매년' }
