## 재현
- 재현 절차: `node -e "import('./src/invoice/invoice.js').then(async i=>{const t=await import('./src/invoice/total.js');const j=JSON.parse(require('fs').readFileSync('examples/INV-2031.json'));console.log(t.computeTotals(i.createInvoice(j)))})"` (또는 `examples/INV-2031.json`을 `createInvoice` → `computeTotals`)
- 결과: 재현됨
- 기대: vat 2,641원, total 29,079원
- 실제: vat 2,644원, total 29,082원

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 세율을 한 번 곱해 `Math.round`로 반올림(2,643.8→2,644)했다. 회계팀은 줄별로 버림해 더하므로(536+633+325+837+310=2,641) 몇 원씩 크게 나온다.
- 근거: `src/invoice/total.js` 24행(수정 전)의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 재현 출력 vat 2644. 수정 후 INV-2031이 2,641/29,079로 나오고 테스트가 통과함(변경 후 실험).
- 사람 추정 판정: 반올림 문제로 보인다 — 맞음 — 합계에 대한 반올림이 원인이다. 다만 반올림을 버림으로 바꾸는 것만으로는 부족하고(합계 버림은 2,643), 줄별 계산이 필요하다.
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — 부가세를 과세 줄마다 `Math.floor(net*10/100)`로 계산해 합산. 영세율은 0 유지. 할인은 `net`(할인 후)에 이미 반영됨.
- `test/total.test.js` — 줄별 버림 합 테스트, 할인 줄 테스트 추가 (기존 테스트는 변경 없음).

## 재현 테스트
- 위치: `test/total.test.js` 마지막 두 테스트
- 수정 전: 실패 (`node --test test/total.test.js` → pass 5, fail 2)
- 수정 후: 통과 (`npm test` → 전부 통과, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 통과 (기존 48개 + 추가 2개, 실패 0)
- 실패 항목: 없음
