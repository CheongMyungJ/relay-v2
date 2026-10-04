## 재현
- 재현 절차: `node -e "import('./src/invoice/credit-note.js').then(m=>{const fs=require('fs');const inv=JSON.parse(fs.readFileSync('examples/INV-2047.json'));const cn=JSON.parse(fs.readFileSync('examples/CN-0112.json'));console.log(m.createCreditNote(inv,cn).totals)})"`
- 결과: 재현됨
- 기대: 줄별 공급가액 9,236 / 6,127 / 2,075 → 부가세 923+612+207 = 1,742, 환불 합계 19,180원
- 실제: vat 1,744, total 19,182원

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 `Math.round`로 부가세를 구해, 줄마다 버림 후 합산하는 회계팀 방식과 어긋난다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`에 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`이 있었다. 17,438 × 10% = 1,743.8 → 1,744. 줄별 버림이면 1,742. 수정 뒤 CN-0112가 19,180원으로 나왔고, 수정을 되돌리면 새 테스트가 실패했다(실험함).
- 사람 추정 판정: 없음
- 기각한 가설: 없음. 인수인계에 있던 가설(`creditTotals`의 합계 기준 `Math.round`)이 맞았다.

## 변경 요약
- src/invoice/credit-note.js — 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)`로 구해 합산한다. 영세율은 0이고 면세 줄은 제외한다. `returnedDiscount`, `computeTotals`, `src/format/`은 바꾸지 않았다.
- test/credit-note.test.js — 테스트 2개를 추가했다. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: test/credit-note.test.js (CN-0112 사례, 면세 제외와 영세율 0)
- 수정 전: 실패 (`npm test` → `not ok 6 - 반품 전표 부가세는 줄마다 원 단위 버림 후 합산한다 (CN-0112)`, pass 47 / fail 1)
- 수정 후: 통과 (`npm test` → pass 48 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음
