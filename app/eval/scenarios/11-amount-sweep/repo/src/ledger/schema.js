import { ParseError } from '../util/errors.js'
import { parseDate } from '../lib/dates.js'

// 원장 머리줄의 이름(한글/영문)을 행 필드로 옮긴다
const ALIASES = {
  date: ['일자', '날짜', 'date'],
  account: ['계정', '계정코드', 'account'],
  category: ['분류', 'category'],
  vendor: ['거래처', 'vendor'],
  memo: ['적요', '메모', 'memo'],
  amount: ['금액', 'amount'],
  vat: ['부가세', 'vat'],
}

export const FIELDS = Object.keys(ALIASES)
const REQUIRED = ['date', 'account', 'amount']

export function mapHeader(cells) {
  const index = {}
  cells.forEach((cell, i) => {
    const name = cell.trim().toLowerCase()
    for (const [field, names] of Object.entries(ALIASES)) {
      if (names.includes(name) && index[field] === undefined) index[field] = i
    }
  })
  const missing = REQUIRED.filter((f) => index[f] === undefined)
  if (missing.length) throw new ParseError(`머리줄에 없는 칸: ${missing.join(', ')}`, 1)
  return index
}

export function toRow(cells, index) {
  const row = {}
  for (const field of FIELDS) {
    const i = index[field]
    row[field] = i === undefined ? '' : (cells[i] ?? '').trim()
  }
  return row
}

// 금액은 여기서 검사하지 않는다. 리포트마다 필요한 방식으로 읽는다
export function validateRow(row, lineNo) {
  if (!parseDate(row.date)) throw new ParseError(`날짜 형식이 아님: ${row.date}`, lineNo)
  if (!/^\d{4}$/.test(row.account)) throw new ParseError(`계정코드는 네 자리 숫자: ${row.account}`, lineNo)
  return row
}
