// 숨긴 시험의 예시 견적서. 줄마다 버림, 줄마다 반올림, 합계 버림·반올림, 할인 전 금액에 버림이 서로 다른 금액을 내게 했다.
export const Q_0457 = {
  number: 'Q-0457',
  customerId: 'C-0388',
  issueDate: '2026-10-06',
  validDays: 14,
  lines: [
    { sku: 'OF-0905', name: '네임펜 흑', unitPrice: 905, qty: 11 },
    { sku: 'EL-1237', name: '전선 몰드 1m', unitPrice: 1237, qty: 8, discount: { percent: 15 } },
    { sku: 'OF-3215', name: '클리어파일 20매', unitPrice: 3215, qty: 3, discount: { amount: 777 } },
    { sku: 'PC-2164', name: '마우스패드', unitPrice: 2164, qty: 4 },
    { sku: 'BK-1680', name: '세무 실무 가이드', unitPrice: 16800, qty: 1, taxType: 'exempt' },
  ],
}

export const Q_0460 = {
  number: 'Q-0460',
  customerId: 'C-0412',
  issueDate: '2026-10-07',
  lines: [
    { sku: 'OF-1342', name: '박스테이프', unitPrice: 1342, qty: 4 },
    { sku: 'OF-1085', name: '스테이플러 심', unitPrice: 1085, qty: 3 },
    { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 5 },
    { sku: 'OF-0345', name: '볼펜 0.5 흑', unitPrice: 345, qty: 9 },
    { sku: 'OF-0415', name: '지우개', unitPrice: 415, qty: 1 },
  ],
}

export const Q_0462 = {
  number: 'Q-0462',
  customerId: 'C-0388',
  issueDate: '2026-10-08',
  lines: [
    { sku: 'OF-7365', name: 'A4 라벨지', unitPrice: 7365, qty: 3, discount: { percent: 20 } },
    { sku: 'FD-1347', name: '커피믹스 100입', unitPrice: 13473, qty: 2, discount: { amount: 1947 } },
    { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 9, discount: { percent: 5 } },
    { sku: 'BK-1680', name: '세무 실무 가이드', unitPrice: 16800, qty: 2, taxType: 'exempt', discount: { amount: 1285 } },
    { sku: 'EL-1237', name: '전선 몰드 1m', unitPrice: 1237, qty: 4 },
  ],
}
