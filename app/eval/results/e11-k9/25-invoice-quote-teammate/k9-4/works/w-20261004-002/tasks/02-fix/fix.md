## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`으로 `createCreditNote` 후 `creditNoteTotals` 호출 (워크트리 루트에서 node 스크립트로 실행)
- 결과: 재현됨
- 기대: 부가세 1,742원, 합계 19,180원 (과세 줄별 내림: 923 + 612 + 207)
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 한 번 `Math.round`로 10%를 매겨 줄별 내림 규칙과 어긋난다 (17,438 × 10% = 1,743.8 → 1,744).
- 근거: `src/invoice/credit-note.js` `creditTotals`의 vat 계산. 실행 결과가 19,182원으로 요청의 값과 같다. 수정 후 1,742원이 되고 줄별 값은 9,236→923, 6,127→612, 2,075→207이다.
- 사람 추정 판정: 없음 (handoff의 내 가설 "`returnedDiscount`도 반올림"은 판단 불가가 아니라 범위 밖으로 둠: 할인 반올림은 청구서(`lineDiscount`)와 같은 방식이고 팀 규칙은 부가세만 다룬다)
- 기각한 가설: 할인 반올림이 원인 — CN-0112의 형광펜 할인 322.5→323은 청구서와 같은 규칙이고, 이 값을 바꾸지 않아도 회계팀 규칙 값이 나온다.

## 변경 요약
- src/invoice/vat.js (신규) — `lineVat`(내림)/`sumLineVat`. 기준 브랜치에 없어 팀 지식 이름대로 새로 만들었다.
- src/invoice/credit-note.js — `creditTotals`의 부가세를 `sumLineVat`(과세 줄별 내림 합, 영세율 0)으로 교체.
- test/credit-note.test.js — 테스트 2개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js "반품 전표 부가세는 과세 줄마다 내림해 합산한다 (CN-0112)"
- 수정 전: 실패 (`node --test test/credit-note.test.js` — not ok 6, vat 1744 ≠ 1742)
- 수정 후: 통과 (같은 명령 7개 통과)
- 저장된 `totals`를 그대로 돌려주는 테스트도 추가함

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
