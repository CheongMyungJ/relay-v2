## 재현
- 재현 절차: `examples/INV-2031.json`을 `createInvoice` → `computeTotals`로 계산 (`node /tmp/r.mjs examples/INV-2031.json`)
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 부가세를 한 번만 계산하고 반올림(`Math.round`)해서, 회계 규정인 줄별 원 단위 버림 합과 달라졌다.
- 근거: `src/invoice/total.js`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)` = round(2643.8) = 2644. 줄별 버림 536+633+325+837+310 = 2,641. 수정 뒤 INV-2031 합계 29,079 확인. 기존 테스트 4건은 줄별 버림으로 바꿔도 같은 값이라 그대로 통과.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 다만 반올림 방식만 바꾸는 것으로는 부족하다. 줄별 반올림은 2,646원이라 규정과 다르고, 계산 단위를 줄별로, 방식을 버림으로 바꿔야 한다.
- 기각한 가설: 발행된 청구서가 재계산된다 — 기각. `invoiceTotals`(src/invoice/invoice.js)는 draft가 아니고 totals가 있으면 저장값을 쓴다. CN/견적이 `computeTotals`를 공유한다 — 기각. `credit-note.js`, `quote.js`는 각자 계산하며 `computeTotals`를 쓰지 않는다.

## 변경 요약
- src/invoice/total.js — `vat`를 과세 줄마다 `Math.floor(net × 세율 / 100)`의 합으로 계산. 영세율은 0 유지, 면세 줄은 제외.
- test/total.test.js — 재현 테스트와 발행 청구서 저장 합계 테스트를 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/total.test.js (INV-2031, 할인 줄, 면세 줄, 영세율, 발행 청구서 저장 합계)
- 수정 전: 실패 — `npm test`, 추가한 줄별 버림 테스트 3건 실패(49~51번), 나머지 49건 통과
- 수정 후: 통과 — `npm test`, 전체 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 53건 전체 통과, 실패 0
- 실패 항목: 없음
