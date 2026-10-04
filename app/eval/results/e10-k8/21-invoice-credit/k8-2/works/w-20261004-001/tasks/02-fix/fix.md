## 재현
- 재현 절차: 워크트리에서 `node -e` 또는 스크립트로 `createInvoice({customerId, lines})`에 `examples/INV-2031.json`의 줄을 넣고 `computeTotals`를 호출한다.
- 결과: 재현됨
- 기대: 부가세 2,641원, 합계 29,079원
- 실제: 부가세 2,644원, 합계 29,082원

## 원인
- 원인: 부가세를 과세 공급가액 합계(26,438원)에 한 번만 10%를 매겨 반올림했다(`Math.round`). 회계팀 방식은 줄마다 버림한 값의 합이다. 반품 전표도 같은 방식이다.
- 근거: `src/invoice/total.js:26`, `src/invoice/credit-note.js:90`이 `Math.round((taxable * 10) / 100)`을 썼다. INV-2031 줄별 버림은 536+633+325+837+310=2,641이고, 합계 반올림은 round(2643.8)=2644다. 줄 금액이 모두 10원 단위이면 두 방식이 같아 기존 테스트가 통과했다. 수정 뒤 INV-2031이 2,641/29,079로 나온다.
- 사람 추정 판정: "반올림 문제로 보인다" — 맞음. 다만 반올림 자체가 아니라 합계에서 한 번 반올림하는 점이 문제이고, 줄별 버림으로 바꿔야 한다.
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/vat.js`(신규) — `computeVat(rows, zeroRated)`: 과세 줄마다 `Math.floor(net*10/100)`을 합한다. 영세율이면 0이다. 두 곳이 같은 규칙을 쓰게 하려고 분리했다.
- `src/invoice/total.js` — vat를 `computeVat`으로 계산한다.
- `src/invoice/credit-note.js` — `creditTotals`의 vat를 `computeVat`으로 계산한다.
- `src/format/`, 발행된 청구서의 저장 합계(`invoice.js:41`, `creditNoteTotals`)는 건드리지 않았다.

## 재현 테스트
- 위치: `test/total.test.js`(INV-2031, 면세 혼합 줄별 버림), `test/credit-note.test.js`(줄별 버림, 영세율 반품 0)
- 수정 전: 실패 (기준 코드로 `node --test`: 50건 중 3건 실패, 2,641 대신 2,644 등)
- 수정 후: 통과 (`npm test`: 50건 모두 통과)
- 영세율 청구서와 면세 줄 0원은 기존 테스트(`total.test.js`)가 계속 통과한다.

## 테스트 실행
- 명령: `npm test`
- 결과: 50건 통과, 0건 실패
- 실패 항목: 없음
