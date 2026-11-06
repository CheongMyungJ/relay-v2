// 고객. 연락처, 언어(ko, en), 배송 지역, 등급(normal, vip).
import { fail } from '../shared/errors.js'

const REGIONS = ['seoul', 'metro', 'local', 'jeju', 'island']
const LOCALES = ['ko', 'en']
const TIERS = ['normal', 'vip']

/** 휴대전화 번호를 010-1234-5678 꼴로. 읽을 수 없으면 null */
export function normalizePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '').replace(/^82/, '0')
  if (!/^01\d{8,9}$/.test(digits)) return null
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function isEmail(text) {
  return typeof text === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
}

export function createCustomers(store) {
  function validate(c) {
    if (!c.id) fail('BAD_CUSTOMER', 'id가 없습니다')
    if (!c.name) fail('BAD_CUSTOMER', `${c.id}: 이름이 없습니다`)
    if (c.email && !isEmail(c.email)) fail('BAD_CUSTOMER', `${c.id}: 메일 주소 ${c.email}`)
    if (!LOCALES.includes(c.locale)) fail('BAD_CUSTOMER', `${c.id}: 언어 ${c.locale}`)
    if (!REGIONS.includes(c.region)) fail('BAD_CUSTOMER', `${c.id}: 지역 ${c.region}`)
    if (!TIERS.includes(c.tier)) fail('BAD_CUSTOMER', `${c.id}: 등급 ${c.tier}`)
  }

  function register({ id, name, email = null, phone = null, locale = 'ko', region = 'seoul', tier = 'normal' }) {
    const normalized = phone ? normalizePhone(phone) : null
    if (phone && !normalized) fail('BAD_CUSTOMER', `${id}: 전화번호 ${phone}`)
    const customer = { id, name, email, phone: normalized, locale, region, tier }
    validate(customer)
    if (store.customers.has(id)) fail('DUPLICATE_CUSTOMER', `이미 있는 고객: ${id}`)
    store.customers.set(id, customer)
    return { ...customer }
  }

  function load(id) {
    const c = store.customers.get(id)
    if (!c) fail('NOT_FOUND', `고객이 없습니다: ${id}`)
    return c
  }

  function get(id) {
    return { ...load(id) }
  }

  function update(id, patch) {
    const c = load(id)
    const next = { ...c, ...patch, id }
    if ('phone' in patch) {
      next.phone = patch.phone ? normalizePhone(patch.phone) : null
      if (patch.phone && !next.phone) fail('BAD_CUSTOMER', `${id}: 전화번호 ${patch.phone}`)
    }
    validate(next)
    store.customers.set(id, next)
    return { ...next }
  }

  function list() {
    return [...store.customers.values()].map((c) => ({ ...c }))
  }

  return { register, get, update, list }
}
