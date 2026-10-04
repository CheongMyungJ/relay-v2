## 재현
- 재현 절차: `examples/INV-2031.json`의 lines로 `createInvoice({customerId:'C-0412', lines})` 후 `computeTotals` 호출 (또는 새 테스트 `npm test`)
- 결과: 재현됨
- 기대: 부가세 2,641원, 합계 29,079원
- 실제: 부가세 2,644원, 합계 29,082원 (공급가액 26,438원 × 10%를 한 번 반올림)

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계에 대해 부가세를 `Math.round`로 한 번만 계산해, 줄별 버림 합(회계팀 규정)보다 커진다.
- 근거: `src/invoice/total.js:27` (수정 전). 줄별 부가세 536+633+325+837+310 = 2,641 대 합계 반올림 2,644. 수정 전 새 테스트 2건 실패, 수정 후 통과(실험 확인).
- 사람 추정 판정: 반올림 문제로 보이며 `src/invoice/total.js`를 봐 달라 — 맞음 — 원인이 total.js의 반올림 방식이다. 다만 `src/money.js`의 `percentOf`는 원인이 아니다(부가세에 쓰이지 않음).
- 기각한 가설: `percentOf`의 `Math.round`가 원인 — `computeTotals`는 `percentOf`를 쓰지 않고, 이 함수는 할인과 반품 전표(비목표)에서만 쓰여 바꾸지 않음

## 변경 요약
- src/invoice/total.js — 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)`로 계산해 `sumWon`으로 합산. 영세율은 0 유지, 합계는 supply + vat 그대로.
- test/total.test.js — 줄별 버림 규칙(INV-2031)과 면세/영세율 0 유지 테스트 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/total.test.js 마지막 두 테스트
- 수정 전: 실패 (`npm test` → 46 pass, 2 fail: #47, #48)
- 수정 후: 통과 (`npm test` → 48 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 48 통과, 0 실패
- 실패 항목: 없음
