## docs/knowledge/invoice/format-output-frozen.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# `src/format/` 출력 형식은 바꾸지 않는다

## 규칙
- `src/format/`은 PDF 생성기가 그대로 사용한다. 금액 계산 규칙을 고칠 때도 이 디렉터리의 파일은 바꾸지 않는다.

## docs/knowledge/invoice/issued-totals-not-recalculated.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 발행된 청구서와 반품 전표의 합계는 다시 계산하지 않는다

## 규칙
- 발행된 청구서는 저장된 `totals`를 그대로 쓴다 (`invoiceTotals`, `creditNoteTotals`). 계산 규칙을 고쳐도 이미 발행된 문서의 합계는 바꾸지 않는다.

## docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: computeVat
---
# 부가세는 과세 줄마다 할인 후 금액에 10%를 매겨 원 단위 버림한 값의 합이다

## 규칙
- 부가세는 과세 품목 줄마다 (공급가액 − 할인) × 10%를 원 단위로 버림(`Math.floor`)하고, 그 합이 청구서 부가세다 (회계팀 방식). 합계에서 다시 반올림하지 않는다.
- 청구서와 반품 전표 모두 같은 규칙이다. 계산은 `src/invoice/vat.js`의 `computeVat` 한 곳에서 하고, 다른 곳에 복사하지 않는다.
- 면세 줄과 영세율 청구서·반품 전표의 부가세는 0이다.
- 예: INV-2031(`examples/INV-2031.json`)은 536+633+325+837+310 = 2,641원, 합계 29,079원 (합계 반올림이면 2,644원으로 틀린다).

## 바뀐 이력
- 2026-10-04 합계 반올림(`Math.round`) → 줄별 버림 합 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/invoice/vat-test-amounts.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 줄 금액이 모두 10원 단위이면 부가세 계산 방식 차이가 테스트에 드러나지 않는다

## 내용
- 줄 금액이 모두 10원 단위이면 합계 반올림과 줄별 버림 결과가 같다. 그래서 합계 반올림 버그가 기존 테스트로는 잡히지 않았다.
- 부가세 테스트는 10원 단위가 아닌 금액(예: 905×7, 1085×3, 345×9)과 할인 줄을 써서 두 방식이 달라지게 만든다. 규칙은 `docs/knowledge/invoice/vat-per-line-floor.md` 참고.
