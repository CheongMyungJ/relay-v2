## 재현
- 재현 절차: `node <scratchpad>/repro.mjs examples/INV-2031.json` (examples의 JSON에 `customerId: 'C-1'`을 붙여 `createInvoice` → `computeTotals` 호출)
- 결과: 재현됨
- 기대: 공급가액 26,438 / 부가세 2,641 / 합계 29,079
- 실제: 공급가액 26,438 / 부가세 2,644 / 합계 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계에 `Math.round`를 한 번만 적용했다. 회계팀 방식은 줄마다 버림 후 합산이다.
- 근거: `src/invoice/total.js`의 기존 `vat` 식 (`Math.round((taxable * 10) / 100)`). 26,438 × 10% = 2,643.8 → 반올림 2,644. 줄별 버림은 536+633+325+837+310 = 2,641. 수정 후 INV-2031이 2,641 / 29,079로 나옴.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계에 한 번 반올림해서 줄별 버림보다 커진다. 다만 반올림 자체가 아니라 계산 단위(합계 vs 줄)와 반올림 방식(반올림 vs 버림)이 어긋난 것이 원인이다.
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — 줄 부가세 `lineVat`(할인된 줄 금액의 10%, 원 미만 버림)을 추가하고, 청구서 부가세를 과세 줄의 `lineVat` 합으로 계산. 영세율은 0 유지, 면세 줄은 제외. 할인은 기존대로 줄마다 먼저 적용된 `net`을 사용.

- `src/invoice/total.js` — `lineVat`를 export해 견적서와 반품 전표가 같은 규칙을 쓰게 함 (사람 요청으로 범위 확대)
- `src/invoice/quote.js` — 견적 부가세를 "할인 전 금액 반올림 − 할인분 반올림"에서 과세 줄별 `lineVat(net)` 합으로 변경. 사용하지 않게 된 import 제거
- `src/invoice/credit-note.js` — 반품 전표 부가세를 과세분 합계 `Math.round`에서 과세 줄별 `lineVat(net)` 합으로 변경. 전표 생성 시 저장하는 `totals`와 저장값 우선 사용(`creditNoteTotals`)은 그대로. 발행된 청구서 합계는 재계산하지 않음
- 기존 테스트는 변경하지 않음 (`src/format/`도 변경 없음)

## 재현 테스트
- 위치: `test/total.test.js` 6~9번째 테스트 (INV-2031 줄별 버림, 할인 줄, 면세 포함, 영세율 다중 줄)
- 수정 전: 실패 (`node --test test/total.test.js` → 6·7·8번 not ok, pass 6 / fail 3. 9번 영세율은 이전에도 통과하는 회귀 확인용)
- 수정 후: 통과 (`npm test` → 52개 모두 통과)
- 견적: `test/quote.test.js` Q-0457(부가세 3,587, 합계 56,278), 영세율. 반품: `test/credit-note.test.js` CN-0112(부가세 1,742, 합계 19,180), 면세·영세율, 할인 줄
- 견적·반품 수정 전: 실패 (`node --test test/quote.test.js test/credit-note.test.js` → Q-0457, CN-0112 테스트 not ok, pass 10 / fail 2. 면세·영세율·할인 줄 테스트는 이전에도 통과하는 회귀 확인용)
- 견적·반품 수정 후: 통과 (`npm test` → 57개 모두 통과)
- 기존 테스트는 변경하지 않음

## 테스트 실행
- 명령: `npm test`
- 결과: tests 57, pass 57, fail 0
- 실패 항목: 없음
