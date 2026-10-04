## docs/knowledge/no-recalc-issued-and-format.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 발행된 청구서는 재계산하지 않고 src/format/ 출력은 바꾸지 않는다

- 종류: 규칙
- 적용: src/invoice/invoice.js(invoiceTotals), src/format/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

발행된 청구서의 합계는 저장값을 그대로 쓰며, 계산 규칙이 바뀌어도 다시 계산하지 않는다(회계 대조·입금 금액이 어긋난다).
src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다.

## docs/knowledge/vat-per-line-floor.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 부가세는 줄별 원 단위 버림의 합이다 (회계팀 기준)

- 종류: 규칙
- 적용: src/invoice/ (청구서, 견적서, 반품 전표 합계)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

과세 품목 줄마다 할인을 먼저 적용한 금액에 10%를 매기고 원 단위 미만을 버린다. 청구서 부가세는 그 줄별 값의 합이며 합계에서 다시 반올림하지 않는다. 면세 줄과 영세율(zeroRated)은 0원.
예: INV-2031 합계 29,082원(옛 방식) → 29,079원(vat 2,641). 견적서 Q-0457 vat 3,587, 반품 전표 CN-0112 vat 1,742도 같은 규칙이다.
관련 위치: src/invoice/total.js의 vatOfRows (청구서·견적서·반품 전표가 공유했던 한 곳).
