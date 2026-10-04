## 재현
- 재현 절차: 워크트리 루트에서 `createCreditNote(examples/INV-2047.json, examples/CN-0112.json)`을 호출해 `totals`를 출력(`node /tmp/repro.mjs`, 두 JSON을 읽어 호출하는 스크립트)
- 결과: 재현됨
- 기대: `totals.total` 19,180 (vat 1,742)
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 한 번 `Math.round(taxable*10/100)`를 해서, 줄마다 절사해 합산하는 회계 방식과 1~3원 어긋난다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 vat 계산. 줄별 절사하면 923+612+207=1,742 → 합계 19,180. 수정 후 같은 입력이 19,180이 되고 되돌리면 재현 테스트가 실패함(실험). 줄이 하나이거나 줄별 값이 모두 10의 배수로 떨어지면 어긋나지 않아 재현되지 않는다.
- 사람 추정 판정: 없음
- 기각한 가설: 반품 수량별 할인 계산(`returnedDiscount`) 오차 — 줄별 net 합(17,438)은 회계 기준 공급가액과 같고 차이는 부가세 2원뿐

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 vat를 과세 줄마다 `Math.floor(net*10/100)` 후 합산으로 변경. 영세율은 0 유지, 면세 줄은 제외. `creditNoteTotals`는 이미 저장된 `totals`를 그대로 반환하므로 변경 없음
- test/credit-note.test.js — 테스트 3개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js ('반품 전표 부가세는 과세 줄마다 절사해 합산한다', '반품 전표 부가세: 면세 줄은 없고 영세율이면 0', '저장된 totals가 있으면 ...')
- 수정 전: 실패 (`npm test` → 앞의 두 테스트 not ok, pass 47 / fail 2)
- 수정 후: 통과 (`npm test` → pass 49 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
