## 재현
- 재현 절차: `node -e "import('./src/index.js').then(m=>{const inv=JSON.parse(require('fs').readFileSync('examples/INV-2031.json'));console.log(m.computeTotals(m.createInvoice(inv)))})"` (customerId가 있는 예제 JSON을 `createInvoice`에 넣어 `computeTotals` 호출)
- 결과: 재현됨
- 기대: vat 2,641, total 29,079 (회계팀 값)
- 실제: vat 2,644, total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계에 부가세를 한 번만 `Math.round`로 계산했다. 줄마다 버림으로 계산해야 하는 규정과 달라 줄별 소수점이 합쳐져 차이가 난다. 반품 전표(`credit-note.js`)와 견적(`quote.js`)도 같은 방식(합계 반올림)이었다.
- 근거: 수정 전 `src/invoice/total.js:25` `Math.round((taxable * 10) / 100)` → 2,644. 줄별 버림 손계산 536+633+325+837+310 = 2,641. 수정 후 테스트에서 2,641 확인. 줄마다 올림 차이가 없는(금액이 10의 배수인) 청구서는 합계가 같아 기존 테스트가 통과했다.
- 사람 추정 판정: "반올림 문제 같다" — 부분적으로 맞음. 반올림이 원인이지만 반올림 방식(합계에 한 번, 반올림)이 문제였고 줄마다 버림이어야 한다.
- 기각한 가설: 없음

## 변경 요약
- src/money.js — `floorPercentOf`(원 단위 버림) 추가
- src/invoice/total.js — `lineVat`(할인된 줄 금액 기준, 면세 줄 0) 추가, `computeTotals`가 줄별 합으로 vat 계산. 영세율은 그대로 0
- src/invoice/credit-note.js — `creditTotals`도 `lineVat` 합으로 계산 (사람 선택: 범위에 포함)
- src/invoice/quote.js — `quoteTotals`를 청구서와 같은 규칙으로 변경 (기존 "할인 전 금액에 매기고 할인분 뺌" 규칙 제거, 사람 선택: 범위에 포함)
- `invoiceTotals`/`creditNoteTotals`의 저장된 합계 사용 경로와 `src/format/`은 변경 없음

## 재현 테스트
- 위치: test/total.test.js (INV-2031, 할인 줄), test/quote.test.js, test/credit-note.test.js (각 마지막 테스트)
- 수정 전: 실패 (`git stash`로 src만 되돌리고 `npm test`: 4건 실패, pass 48)
- 수정 후: 통과 (`npm test`: pass 52, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 52개 통과, 0개 실패
- 실패 항목: 없음 (기존 테스트 변경 없음)
