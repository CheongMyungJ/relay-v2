## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 반품 처리해 `totals`를 출력 (`node` 스크립트로 실행)
- 결과: 재현됨
- 기대: 줄별 버림 부가세 923+612+207 = 1,742원, 합계 19,180원
- 실제: `{ supply: 17438, vat: 1744, total: 19182 }` (부가세 1,744원, 합계 19,182원)

## 원인
- 원인: `creditTotals`가 부가세를 과세 공급가액 합계에 한 번 `Math.round`로 계산해(줄별 버림 아님) 줄별 버림 합과 몇 원씩 어긋난다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 `Math.round((taxable*VAT)/100)` = round(1743.8) = 1744. 줄별 floor는 923, 612, 207 → 1742. 수정 뒤 1742/19180으로 바뀌는 것을 확인(수정 전후 테스트 비교).
- 사람 추정 판정: 없음
- 기각한 가설: 줄 할인 반올림(`returnedDiscount`)이 원인 — 팀 규칙 밖이고 이번 범위에 넣지 않음. 6127원 줄은 5% 할인 322.5가 반올림되지만 규칙은 부가세 버림만 정한다.

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net*10/100)`로 계산해 합산. 영세율이면 0. `creditNoteTotals`는 저장된 `totals`를 그대로 돌려주는 기존 동작 유지.
- test/credit-note.test.js — 테스트 2개 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js "반품 전표 부가세는 줄마다 원 단위 버림으로 합산한다 (CN-0112)"
- 수정 전: 실패 (`node --test test/credit-note.test.js` → pass 6, fail 1)
- 수정 후: 통과 (같은 명령 → pass 7, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
