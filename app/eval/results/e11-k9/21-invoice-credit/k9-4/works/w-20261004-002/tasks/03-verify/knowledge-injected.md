## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 과세 품목 줄마다 원 단위 버림 후 합산한다

## 규칙
- 부가세는 과세 품목 줄마다 할인 적용 후 공급가액에 10%를 곱해 원 단위로 버림(`Math.floor(net * 10 / 100)`)하고 합산한다. 회계팀 대조 기준이다.
- 합계에서 다시 반올림하지 않는다. 청구서와 반품 전표 모두 같다.
- 면세 품목과 영세율 청구서의 부가세는 0이다.
- 계산은 `lineVat` (src/invoice/total.js) 한 곳에 두고, 청구서(`computeTotals`)와 반품 전표(`creditTotals`)가 함께 쓴다.
- 발행된 청구서와 전표는 저장된 합계를 그대로 쓰고 다시 계산하지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김. 합계 기준 반올림 → 품목별 버림 합산 (Work w-20261004-001, 사람이 알려 줌)
