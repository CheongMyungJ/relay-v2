## docs/knowledge/billing/vat-per-line-floor.md

---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 할인 후 품목 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 할인은 부가세 전에 품목 줄마다 적용한다. 부가세는 할인된 줄 금액에 줄마다 원 단위 버림(`Math.floor(net*10/100)`)으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다 (회계팀 규칙).
- 청구서(`computeTotals`), 견적서(`quoteTotals`), 반품 전표(`creditTotals`)는 모두 `src/invoice/total.js`의 `lineVat`를 쓴다.
- 예: INV-2031(`examples/INV-2031.json`) 합계는 29,079원 (부가세 2,641원).
- 예: CN-0112(`examples/CN-0112.json`을 `examples/INV-2047.json`에 반품 처리) 부가세는 923+612+207 = 1,742원, 합계 19,180원. 합계 반올림이면 1,744원/19,182원으로 어긋난다.
- 발행된 청구서와 만들어진 반품 전표는 저장한 합계(`totals`)를 그대로 쓰고 다시 계산하지 않는다.

## 아직 규칙을 따르지 않는 곳
- `src/invoice/credit-note.js` `creditTotals`: 이 Work(w-20261004-002) 브랜치에 `lineVat`가 없어 줄별 `Math.floor`를 직접 계산한다. 결과는 규칙과 같다. 앞 Work(w-20261004-001) 머지 뒤 `lineVat`를 쓰도록 바꾼다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
- 2026-10-04 반품 전표 `creditTotals`의 합계 반올림을 줄별 버림으로 고침, CN-0112 예 추가 (Work w-20261004-002)
