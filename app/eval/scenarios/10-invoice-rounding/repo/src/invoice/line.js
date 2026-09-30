import { assertWon } from '../money.js'
import { assertTaxType } from './tax-type.js'

// 입력으로 받은 품목 줄을 확인하고 기본값을 채운다
// raw: { sku?, name, unitPrice, qty?, taxType?, discount? }
export function normalizeLine(raw, index = 0) {
  const where = `${index + 1}번째 품목`
  if (!raw || typeof raw !== 'object') throw new TypeError(`${where}이 비었다`)
  const name = String(raw.name ?? '').trim()
  if (!name) throw new Error(`${where}: 품목 이름이 없다`)
  const unitPrice = assertWon(raw.unitPrice, `${where} 단가`)
  if (unitPrice < 0) throw new RangeError(`${where}: 단가가 음수다`)
  const qty = raw.qty ?? 1
  if (!Number.isInteger(qty) || qty <= 0) throw new RangeError(`${where}: 수량은 1 이상의 정수여야 한다`)
  const line = {
    sku: raw.sku ? String(raw.sku) : null,
    name,
    unitPrice,
    qty,
    taxType: assertTaxType(raw.taxType ?? 'taxable'),
  }
  if (raw.discount != null) line.discount = normalizeDiscount(raw.discount, where)
  return line
}

function normalizeDiscount(discount, where) {
  if ('percent' in discount) {
    const p = discount.percent
    if (typeof p !== 'number' || p <= 0 || p > 100) throw new RangeError(`${where}: 할인율은 0 초과 100 이하`)
    return { percent: p }
  }
  if ('amount' in discount) {
    const a = assertWon(discount.amount, `${where} 할인 금액`)
    if (a <= 0) throw new RangeError(`${where}: 할인 금액은 0보다 커야 한다`)
    return { amount: a }
  }
  throw new Error(`${where}: 할인은 { percent } 또는 { amount }로 적는다`)
}

// 할인 전 품목 금액
export function lineGross(line) {
  return line.unitPrice * line.qty
}

// 같은 품목(sku, 단가, 과세 구분, 할인이 같음)을 한 줄로 합친다
export function mergeSameLines(lines) {
  const out = []
  const byKey = new Map()
  for (const line of lines) {
    if (!line.sku) {
      out.push({ ...line })
      continue
    }
    const key = [line.sku, line.unitPrice, line.taxType, JSON.stringify(line.discount ?? null)].join('|')
    const found = byKey.get(key)
    if (found) {
      found.qty += line.qty
    } else {
      const copy = { ...line }
      byKey.set(key, copy)
      out.push(copy)
    }
  }
  return out
}
