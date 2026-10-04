## 재현
- 재현 절차: 레포 루트에서 `createCreditNote(INV-2047, CN-0112)`를 만들어 `totals`를 출력한다 (examples/INV-2047.json, examples/CN-0112.json을 읽어 `src/invoice/credit-note.js`의 `createCreditNote` 호출)
- 결과: 재현됨
- 기대: 줄별 버림 합 부가세 1,742원, 합계 19,180원
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 부가세를 과세 공급가액 합계에 한 번 `Math.round`해서 구한다. 줄별 버림 규칙과 어긋난다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 `vat` 줄. 줄별 순액 9,236 / 6,127 / 2,075 → 923 + 612 + 207 = 1,742. 합계 기준은 17,438 × 10% = 1,743.8 → 1,744. 수정 뒤 실행하면 1,742 / 19,180이 나온다. 줄 순액(할인 반올림 포함)은 그대로라 supply는 변하지 않는다.
- 사람 추정 판정: 없음 (추가 의견은 회계팀 기준 미확인 사실뿐)
- 기각한 가설: 할인 반올림이 차이의 원인 — 기각. 비목표이고, CN-0112 줄 순액을 손으로 계산해 보니 supply 17,438은 그대로이며 차이는 부가세 반올림 방식에서만 나온다.

## 변경 요약
- src/invoice/credit-note.js — `vat`를 과세 줄마다 `Math.floor(net × 10%)`한 값의 합으로 변경. 영세율은 0 유지, 면세 줄은 제외
- test/credit-note.test.js — 테스트 3개와 `node:fs` import 추가. 기존 테스트는 변경하지 않음

## 재현 테스트
- 위치: test/credit-note.test.js (`반품 전표 부가세는 과세 줄마다 버림한 합이다`, `CN-0112 부가세는 줄별 버림 합이다`, `저장된 totals가 있으면 다시 계산하지 않는다`)
- 수정 전: 실패 (`node --test test/credit-note.test.js` → 6, 7번 not ok, 2건 실패)
- 수정 후: 통과 (`npm test` → 51 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 51개 통과, 0개 실패 (`test/format.test.js` 포함)
- 실패 항목: 없음
