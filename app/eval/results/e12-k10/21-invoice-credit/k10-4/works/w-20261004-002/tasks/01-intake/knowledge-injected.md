## docs/knowledge/billing/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: sumLineVat
---
# 부가세는 과세 줄마다 원 단위 버림 후 합산한다

## 규칙
- 과세 품목 줄마다 (할인 적용 후 줄 금액 × 세율)을 원 단위로 버림하고, 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다. 회계팀 규칙이다.
- 청구서와 반품 전표 모두 같은 규칙을 쓴다. 계산은 `src/invoice/total.js`의 `lineVat`/`sumLineVat` 한 곳에 둔다.
- 면세 줄은 부가세가 없고, 영세율은 부가세가 0이다. 세율은 `src/config.js`의 `VAT_RATE_PERCENT`.
- 이미 발행된 청구서는 저장된 `totals`를 그대로 쓰고 다시 계산하지 않는다.
- 회계팀 대조값: INV-2031 부가세 2,641원, 합계 29,079원 (옛 합계 기준 반올림은 29,082원).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
