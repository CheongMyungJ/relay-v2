// 숨긴 시험의 예시 청구서. 품목 줄 공급가액의 끝자리를 골라,
// 합계 반올림·줄마다 반올림·줄마다 버림·은행가 반올림·합계 버림이 모두 다른 합계를 내게 했다.

// 리포트의 청구서
export const INV_2031 = {
  number: 'INV-2031',
  customerId: 'C-0412',
  issueDate: '2026-09-14',
  lines: [
    { sku: 'OF-1342', name: '박스테이프', unitPrice: 1342, qty: 4 },
    { sku: 'OF-0905', name: '네임펜 흑', unitPrice: 905, qty: 7 },
    { sku: 'OF-1085', name: '스테이플러 심', unitPrice: 1085, qty: 3 },
    { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 5 },
    { sku: 'OF-0345', name: '볼펜 0.5 흑', unitPrice: 345, qty: 9 },
  ],
}

export const INV_2038 = {
  number: 'INV-2038',
  customerId: 'C-0388',
  issueDate: '2026-09-18',
  lines: [
    { sku: 'OF-0415', name: '지우개', unitPrice: 415, qty: 1 },
    { sku: 'OF-0905', name: '네임펜 흑', unitPrice: 905, qty: 11 },
    { sku: 'EL-1237', name: '전선 몰드 1m', unitPrice: 1237, qty: 8 },
    { sku: 'OF-3215', name: '클리어파일 20매', unitPrice: 3215, qty: 3 },
    { sku: 'PC-2164', name: '마우스패드', unitPrice: 2164, qty: 4 },
  ],
}

// 면세 품목(도서)이 섞인 청구서
export const INV_2040 = {
  number: 'INV-2040',
  customerId: 'C-0412',
  issueDate: '2026-09-19',
  lines: [
    { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 9 },
    { sku: 'EL-1237', name: '전선 몰드 1m', unitPrice: 1237, qty: 4 },
    { sku: 'BK-1680', name: '세무 실무 가이드', unitPrice: 16800, qty: 2, taxType: 'exempt' },
    { sku: 'OF-0415', name: '지우개', unitPrice: 415, qty: 9 },
    { sku: 'OF-7365', name: 'A4 라벨지', unitPrice: 7365, qty: 3 },
    { sku: 'OF-0905', name: '네임펜 흑', unitPrice: 905, qty: 5 },
  ],
}

// 줄마다 할인이 붙은 청구서
export const INV_2047 = {
  number: 'INV-2047',
  customerId: 'C-0388',
  issueDate: '2026-09-24',
  lines: [
    { sku: 'EL-3845', name: '건전지 AA 4입', unitPrice: 3845, qty: 1 },
    { sku: 'OF-0415', name: '지우개', unitPrice: 415, qty: 9 },
    { sku: 'OF-3215', name: '클리어파일 20매', unitPrice: 3215, qty: 9 },
    { sku: 'OF-1342', name: '박스테이프', unitPrice: 1342, qty: 8, discount: { amount: 1500 } },
    { sku: 'OF-2150', name: '형광펜 5색', unitPrice: 2150, qty: 6, discount: { percent: 5 } },
  ],
}

export const INV_2052 = {
  number: 'INV-2052',
  customerId: 'C-0412',
  issueDate: '2026-09-28',
  lines: [
    { sku: 'OF-7365', name: 'A4 라벨지', unitPrice: 7365, qty: 1 },
    { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 1 },
    { sku: 'OF-3215', name: '클리어파일 20매', unitPrice: 3215, qty: 3, discount: { percent: 20 } },
    { sku: 'PC-1876', name: '케이블 타이 100입', unitPrice: 1876, qty: 11, discount: { amount: 1000 } },
    { sku: 'OF-0345', name: '볼펜 0.5 흑', unitPrice: 345, qty: 3 },
  ],
}

// ---- Work 2: 반품 전표 ----
// 돌려받는 줄의 공급가액 끝자리를 골라, 합계 반올림(지금 코드)·줄마다 반올림·줄마다 버림·합계 버림이
// 모두 다른 부가세를 내게 했다. 금액 할인이 붙은 줄은 모두 돌려받아 할인을 나누는 방식에 기대지 않는다

// 리포트의 반품 전표. 박스테이프(금액 할인) 전부, 형광펜(5% 할인) 일부, 지우개 일부
export const CN_0112 = {
  invoice: INV_2047,
  number: 'CN-0112',
  issueDate: '2026-10-06',
  reason: '파손 및 주문 착오',
  returns: [
    { sku: 'OF-1342', qty: 8 },
    { sku: 'OF-2150', qty: 3 },
    { sku: 'OF-0415', qty: 5 },
  ],
}

// 클리어파일(20% 할인) 일부, 케이블 타이(금액 할인) 전부
export const CN_0121 = {
  invoice: INV_2052,
  number: 'CN-0121',
  issueDate: '2026-10-14',
  reason: '규격 착오',
  returns: [
    { sku: 'OF-3215', qty: 2 },
    { sku: 'PC-1876', qty: 11 },
    { sku: 'OF-0345', qty: 3 },
  ],
}

export const CN_0115 = {
  invoice: INV_2038,
  number: 'CN-0115',
  issueDate: '2026-10-08',
  reason: '초과 납품',
  returns: [
    { sku: 'OF-0905', qty: 3 },
    { sku: 'EL-1237', qty: 5 },
    { sku: 'PC-2164', qty: 2 },
  ],
}

// 면세 품목(도서)이 섞인 반품
export const CN_0118 = {
  invoice: INV_2040,
  number: 'CN-0118',
  issueDate: '2026-10-10',
  reason: '중복 주문',
  returns: [
    { sku: 'OF-1675', qty: 3 },
    { sku: 'BK-1680', qty: 1 },
    { sku: 'OF-0415', qty: 3 },
    { sku: 'OF-7365', qty: 1 },
  ],
}
