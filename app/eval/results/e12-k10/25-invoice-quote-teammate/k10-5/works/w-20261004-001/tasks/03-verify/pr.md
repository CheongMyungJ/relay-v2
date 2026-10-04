# 부가세를 과세 줄마다 원 단위 버림 후 합산하도록 수정

## 요약
청구서·반품 전표·견적서의 부가세를 회계 규정(줄마다 원 단위 버림 후 합산)에 맞췄다. INV-2031 합계는 29,082원에서 29,079원이 된다.

## 원인
부가세를 줄마다가 아니라 과세 공급가액 합계에 한 번 곱해 `Math.round`로 반올림했다. 견적서는 할인 전 금액 합과 할인 합에 각각 반올림해 뺐다.

## 변경
- `src/money.js`: `percentOfFloor` 추가
- `src/invoice/total.js`, `credit-note.js`, `quote.js`: 과세 줄마다 할인 후 공급가액에 버림 적용 후 합산
- 발행된 청구서의 저장된 `totals`와 `src/format/`은 바꾸지 않음
- `docs/knowledge/billing/vat-rounding.md`: 규정 기록

## 테스트
- `npm test`: 52 통과
- `node src/cli.js examples/INV-2031.json --totals`: 합계 29,079원
- 추가 테스트: INV-2031, 반품 전표, 견적서(할인 줄 포함)
