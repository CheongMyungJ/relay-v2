## docs/knowledge/credit-note-quote-vat-differs.md

# 전표와 견적서의 부가세 계산은 청구서와 따로 있다

- 종류: 사실
- 적용: src/invoice/credit-note.js, src/invoice/quote.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

이 Work는 청구서(computeTotals)만 줄별 버림으로 바꿨다. 반품 전표와 견적서는 별도 계산으로 합계 기준 Math.round를 쓰고 있었고 바꾸지 않았다.
청구서 부가세 규칙을 다룰 때 이 둘에도 적용할지는 회계팀 기준으로 따로 정해야 한다.

## docs/knowledge/issued-invoice-and-format-frozen.md

# 발행된 청구서는 재계산하지 않고 src/format/ 출력은 바꾸지 않는다

- 종류: 규칙
- 적용: src/invoice/invoice.js (invoiceTotals), src/format/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

이미 발행된 청구서의 합계는 발행 때 저장된 값을 유지한다. 계산 규칙을 바꿔도 발행분을 다시 계산하거나 바꾸지 않는다.
`src/format/`의 출력 형식은 PDF 생성기가 그대로 찍기 때문에 바꾸지 않는다.
관련 위치: invoiceTotals는 저장된 totals가 있으면 그것을 쓴다. totals가 저장되지 않은 발행분은 새 규칙으로 계산될 수 있다.

## docs/knowledge/no-recalc-issued-and-format.md

# 발행된 청구서와 만든 반품 전표는 재계산하지 않고 src/format/ 출력은 바꾸지 않는다

- 종류: 규칙
- 적용: src/invoice/invoice.js(invoiceTotals), src/invoice/credit-note.js(creditNoteTotals), src/format/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, w-20261003-002, 2026-10-03

발행된 청구서의 합계는 저장값을 그대로 쓰며, 계산 규칙이 바뀌어도 다시 계산하지 않는다(회계 대조·입금 금액이 어긋난다).
이미 만든 반품 전표도 같다. 저장된 totals가 있으면 그대로 쓰고, 계산 규칙(예: 부가세 줄별 버림)이 바뀌어도 다시 계산하지 않는다. 새 규칙은 새로 만드는 전표에만 적용된다.
src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다.

## docs/knowledge/vat-per-line-floor-sum.md

# 청구서 부가세는 줄별 원 단위 버림의 합이다

- 종류: 규칙
- 적용: src/invoice/total.js (computeTotals)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

회계팀 기준: 과세 품목 줄마다 할인을 먼저 적용한 금액에 부가세를 매기고 원 단위 미만을 버린다. 청구서 부가세는 그 줄별 값의 합이며 합계에서 다시 반올림하지 않는다.
예: INV-2031은 536+633+325+837+310 = 2,641원, 합계 29,079원 (합계 기준 반올림이면 2,644원, 29,082원으로 3원 크다).
면세 줄과 영세율(zeroRated) 청구서의 부가세는 0원이다.

## docs/knowledge/vat-per-line-floor.md

# 부가세는 줄별 원 단위 버림의 합이다 (회계팀 기준)

- 종류: 규칙
- 적용: src/invoice/ (청구서, 견적서, 반품 전표 합계)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

과세 품목 줄마다 할인을 먼저 적용한 금액에 10%를 매기고 원 단위 미만을 버린다. 청구서 부가세는 그 줄별 값의 합이며 합계에서 다시 반올림하지 않는다. 면세 줄과 영세율(zeroRated)은 0원.
예: INV-2031 합계 29,082원(옛 방식) → 29,079원(vat 2,641). 견적서 Q-0457 vat 3,587, 반품 전표 CN-0112 vat 1,742도 같은 규칙이다.
관련 위치: src/invoice/total.js의 vatOfRows (청구서·견적서·반품 전표가 공유했던 한 곳).
