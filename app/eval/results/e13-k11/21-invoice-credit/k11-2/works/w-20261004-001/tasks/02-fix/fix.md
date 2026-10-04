## 재현
- 재현 절차: `examples/INV-2031.json`을 `createInvoice`로 만들어 `computeTotals` 실행 (품목 줄에 taxType가 없으면 createInvoice가 과세로 채움). 반품은 `createCreditNote(INV-2047, CN-0112)`.
- 결과: 재현됨
- 기대: INV-2031 부가세 2,641원, 합계 29,079원
- 실제: 부가세 2,644원, 합계 29,082원 (CN-0112는 부가세 1,744원, 합계 19,182원)

## 원인
- 원인: 부가세를 과세 공급가액 합계에 한 번만 `Math.round(taxable*10/100)`로 계산했다. 규정은 줄별 원 단위 버림 후 합산이다.
- 근거: `src/invoice/total.js:26`, `src/invoice/credit-note.js:90`. 줄별 버림 합(536+633+325+837+310=2,641)과 합계 반올림(2,643.8→2,644)이 다르다. 수정 후 29,079로 바뀌는 것을 실험으로 확인했다.
- 사람 추정 판정: "반올림 문제로 보인다" — 맞음 (합계 단위 반올림이 원인. 다만 위치는 `total.js` 외에 `credit-note.js`에도 있다)
- 기각한 가설: 없음

## 변경 요약
- src/invoice/total.js — `lineVat`(줄별 버림) 추가, `computeTotals`가 과세 줄마다 합산. 영세율은 0 유지, 면세 줄 제외 유지.
- src/invoice/credit-note.js — `creditTotals`도 `lineVat`로 줄별 합산. 저장된 `totals`를 쓰는 `creditNoteTotals`는 그대로.
- test/total.test.js, test/credit-note.test.js — 테스트 추가만 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/total.test.js (INV-2031, 영세율/면세), test/credit-note.test.js (CN-0112: 부가세 923+612+207=1,742, 합계 19,180원, 영세율/면세)
- 수정 전: 실패 (src를 되돌리고 `npm test`: 새 테스트 실패)
- 수정 후: 통과 (`npm test` 50개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 통과, 0 실패
- 실패 항목: 없음
