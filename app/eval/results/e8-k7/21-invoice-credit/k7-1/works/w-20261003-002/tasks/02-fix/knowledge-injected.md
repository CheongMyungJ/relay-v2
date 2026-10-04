## docs/knowledge/vat-code-locations.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 부가세 계산 위치와 percentOf의 용도

- 종류: 사실
- 적용: src/invoice/total.js, src/money.js, src/invoice/credit-note.js, src/invoice/discount.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

청구서 부가세를 계산하는 곳은 computeTotals(src/invoice/total.js)다. percentOf(src/money.js, Math.round)는 부가세가 아니라 할인과 반품 전표 계산용이므로 부가세 문제로 바꾸지 않는다.
반품 전표(src/invoice/credit-note.js)는 부가세를 합계에 대해 Math.round로 따로 계산한다. 이 Work에서는 비목표라 바꾸지 않았으니, 바꿀 때는 새 일로 사람에게 확인한다.

## docs/knowledge/vat-floor-per-line.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 부가세는 과세 줄마다 원 단위 버림으로 계산해 합산한다

- 종류: 규칙
- 적용: src/invoice/total.js (computeTotals), 부가세를 새로 계산하는 모든 곳
- 출처: 사람이 알려 줌 (회계팀 규정), relay Work w-20261003-001, 2026-10-03

부가세는 과세 품목 줄마다 (할인 후 공급가액 × 세율)을 원 단위로 버림(Math.floor)하고, 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다. 합계는 공급가액 + 부가세다.
예: INV-2031은 줄별 536+633+325+837+310 = 부가세 2,641원, 합계 29,079원이다. 공급가액 합 26,438원에 한 번 반올림하면 2,644원으로 3원 크게 나온다.
면세 줄과 영세율(zeroRated) 청구서의 부가세는 0원이다.
이번 Work는 새로 계산하는 청구서만 고쳤다. 이미 저장된 totals와 반품 전표(CN)의 저장 금액은 바로잡지 않기로 했다.
