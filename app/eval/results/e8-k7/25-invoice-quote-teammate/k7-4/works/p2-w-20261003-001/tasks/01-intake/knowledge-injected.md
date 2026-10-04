## docs/knowledge/issued-invoice-no-recalc.md

# 이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다

- 종류: 규칙
- 적용: 청구서 합계 조회 (invoiceTotals 부근), 발행 시 저장되는 totals
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

계산 규칙(예: 부가세)을 바꿔도 발행된 청구서의 금액은 바뀌면 안 된다. status가 draft가 아니고 저장된 totals가 있으면 그 값을 그대로 쓴다. 규칙 변경 전에 발행된 청구서가 새 규칙으로 다시 계산되는 일이 없게 한다.

## docs/knowledge/vat-per-line-floor.md

# 부가세는 품목 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산한다

- 종류: 규칙
- 적용: `src/invoice/` 청구서, 반품 전표, 견적서의 부가세 계산 (관련 위치: `tax-type.js`, `total.js`, `credit-note.js`, `quote.js`)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

부가세 = 과세 줄마다 `floor(할인 후 금액 × 10 / 100)`을 구해 더한 값이다. 합계(공급가액 합)에서 다시 반올림하지 않고, 할인 전 금액에 매기지도 않는다.
청구서, 반품 전표, 견적서 모두 같은 규칙이다. 예: INV-2031 부가세 2,641원(합계 29,079원), CN-0112 합계 19,180원, Q-0457 합계 56,278원.
틀린 방식: 합계에 `Math.round`(INV-2031이 2,644원으로 3원 큼), 견적서의 할인 전 금액 반올림 후 할인분 부가세 차감.
이미 발행된 청구서는 저장된 합계를 쓰고 다시 계산하지 않는다.

## docs/knowledge/vat-separate-calc-in-quote-credit-note.md

# 견적서와 환불(크레딧 노트)은 computeTotals를 쓰지 않고 부가세를 따로 계산한다

- 종류: 실패 유형
- 적용: src/invoice/quote.js, src/invoice/credit-note.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

부가세 규칙을 바꿀 때 total.js만 고치면 두 파일의 부가세가 청구서와 몇 원씩 어긋날 수 있다(조사 당시 credit-note는 합계에 Math.round, quote는 다른 방식). 2026-10-03 Work에서는 intent 범위 밖이라 고치지 않았다. 부가세 규칙을 바꾸는 일에서는 이 두 파일도 함께 확인한다.
