## 재현
- 재현 절차: `node -e "import('./src/invoice/total.js').then(async m=>{const {createInvoice}=await import('./src/invoice/invoice.js');const fs=require('fs');console.log(m.computeTotals(createInvoice({...JSON.parse(fs.readFileSync('examples/INV-2031.json')),customerId:'C'})))})"`
- 결과: 재현됨
- 기대: 합계 29,079원 (부가세 2,641원)
- 실제: 합계 29,082원 (부가세 2,644원)

## 원인
- 원인: `computeTotals`가 부가세를 과세 공급가액 합계(26,438원)에 한 번만 반올림(`Math.round`)해 구했다. 회계 규정은 줄마다 버림한 값의 합이다.
- 근거: `src/invoice/total.js:28`(수정 전). 손계산: 줄별 부가세 536+633+325+837+310 = 2,641원(버림), 합계 반올림은 2,643.8 → 2,644원. 수정 뒤 INV-2031 합계 29,079원 확인. 줄 금액이 이미 할인 후 `net`이라 할인 순서는 규정과 맞았다. 합계 반올림과 줄별 버림은 줄 수가 많고 소수 부분이 클수록 차이가 커져 줄이 하나이고 10원 단위로 떨어지는 금액에서는 재현되지 않는다(기존 테스트가 통과한 이유).
- 사람 추정 판정: "반올림 문제 같고 `src/invoice/total.js` 쪽" — 맞음 — 합계 한 번 반올림이 원인이고 위치도 `total.js:28`이다.
- 기각한 가설: `sumWon`/`percentOf` 문제 — `sumWon`은 정수 합만 하고, 할인 계산(`percentOf`)은 이 청구서에 할인이 없어 관여하지 않는다.

## 변경 요약
- `src/invoice/total.js` — 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)`로 구해 합하도록 바꿨다. 영세율은 0 유지, 면세 줄 제외, 반환 필드 구조 그대로.

## 재현 테스트
- 위치: `test/total.test.js` 마지막 두 테스트(줄별 버림 / 할인된 줄 금액 기준 부가세, 면세 제외)
- 수정 전: 실패 (`npm test` → 47, 48번 `not ok`, pass 46 / fail 2)
- 수정 후: 통과 (`npm test` → pass 48 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음
