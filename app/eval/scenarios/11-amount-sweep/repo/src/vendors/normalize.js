// 거래처 이름 맞추기. '(주)가나상사', '주식회사 가나상사', '가나상사 ' 를 같은 거래처로 본다
const PREFIXES = [/^\(주\)\s*/, /^㈜\s*/, /^주식회사\s+/, /^\(유\)\s*/, /^유한회사\s+/]
const SUFFIXES = [/\s*\(주\)$/, /\s*㈜$/, /\s+주식회사$/]

export function normalizeVendor(name) {
  let s = String(name ?? '').replace(/\s+/g, ' ').trim()
  for (const re of PREFIXES) s = s.replace(re, '')
  for (const re of SUFFIXES) s = s.replace(re, '')
  return s || '(거래처 없음)'
}

export function sameVendor(a, b) {
  return normalizeVendor(a) === normalizeVendor(b)
}
