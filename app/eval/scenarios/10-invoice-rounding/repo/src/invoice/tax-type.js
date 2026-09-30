// 품목의 과세 구분

export const TAX_TYPES = {
  taxable: '과세',
  exempt: '면세',
}

export function assertTaxType(type) {
  if (!Object.hasOwn(TAX_TYPES, type)) {
    throw new Error(`알 수 없는 과세 구분: ${type} (${Object.keys(TAX_TYPES).join(', ')} 중 하나)`)
  }
  return type
}

// 부가세를 매기는 품목인지. 영세율 청구서도 과세 품목이지만 세율이 0이다
export function isTaxableLine(line) {
  return line.taxType === 'taxable'
}

export function taxTypeLabel(line) {
  return TAX_TYPES[line.taxType]
}
