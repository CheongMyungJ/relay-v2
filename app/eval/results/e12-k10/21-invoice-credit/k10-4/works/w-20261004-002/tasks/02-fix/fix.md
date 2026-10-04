## 재현
- 재현 절차: `examples/INV-2047.json`을 청구서로, `examples/CN-0112.json`을 데이터로 `createCreditNote(invoice, data)`를 호출해 `totals`를 출력한다.
- 결과: 재현됨
- 기대: 줄별 부가세 923 + 612 + 207 = 1,742원, 환불 합계 19,180원 (팀 규칙 계산값)
- 실제: `{ supply: 17438, vat: 1744, total: 19182 }` — 합계 17,438원에서 한 번 반올림해 1,743.8→1,744

## 원인
- 원인: `creditTotals`가 부가세를 `Math.round(taxable * 세율 / 100)`로 과세 합계에서 한 번 반올림했다. 줄별 버림 규칙과 달라 몇 원씩 어긋난다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. 줄 공급가액 9236/6127/2075 → 줄별 버림 1742, 합계 반올림 1744. 수정 전 재현 출력 19182, 수정 뒤 19180. 줄 합계 반올림과 버림 합이 같아지는 경우(소수 부분이 작은 경우)에는 재현되지 않는다.
- 사람 추정 판정: 없음
- 기각한 가설: 금액 할인 안분(`returnedDiscount`) 반올림 — 이 사례는 박스테이프를 전량 반품해 안분이 없고, 형광펜은 비율 할인이라 청구서와 같은 `percentOf`를 쓴다. 원인이 아니며 규칙 대상도 아니라 그대로 둠.

## 변경 요약
- `src/invoice/total.js` — `lineVat`/`sumLineVat` 추가(팀 지식이 정한 한 곳). 이 브랜치에 없었음. `computeTotals`는 건드리지 않음(비목표).
- `src/invoice/credit-note.js` — `creditTotals`가 `sumLineVat`을 쓰도록 변경. 저장된 `totals`를 쓰는 `creditNoteTotals`는 그대로.
- `test/credit-note.test.js` — 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/credit-note.test.js` "반품 부가세는 과세 줄마다 버림한 합이다 (CN-0112)", 영세율/면세 테스트
- 수정 전: 실패 — `node --test test/credit-note.test.js` 에서 `not ok 6` (vat 1744 ≠ 1742)
- 수정 후: 통과 — 같은 명령 pass 7, fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 통과 (전체 48건)
- 실패 항목: 없음
