## 재현
- 재현 절차: `node --test test/quote.test.js` (또는 `createQuote`에 `examples/Q-0457.json`을 넣어 `totals` 확인)
- 결과: 재현됨
- 기대: Q-0457 supply 52,691 / vat 3,587 / total 56,278, 영세율 견적 vat 0
- 실제: vat 5,267 / total 57,958 (면세 줄에도 부가세), 영세율 견적 vat 9,600 (테스트 3, 4번 실패)

## 원인
- 원인: `quoteTotals`가 `lineVat(net, taxable)`(두 번째 인자는 불리언)에 `{ taxable, zeroRated }` 객체를 넘긴다. 객체는 항상 참이라 면세 줄에도 10%가 붙고 `zeroRated`는 무시된다.
- 근거: `src/invoice/total.js:17` 시그니처 `lineVat(net, taxable)`, `src/invoice/quote.js:39` 객체 전달. `credit-note.js:91`은 불리언을 넘겨 정상. 실험: 호출을 `r.taxable && !quote.zeroRated`로 바꾸자 quote 테스트 4건 모두 통과, Q-0457 합계 56,278.
- 사람 추정 판정: 추정 — "우리 합계 56,280원" 값은 현재 코드와 다름(57,958) — 판단 불가 — 원본 출처를 알 수 없고 56,280이 나오는 계산 경로를 찾지 못함. 경리 금액 56,278과는 수정 후 일치.
- 기각한 가설: 없음

## 변경 요약
- src/invoice/quote.js — `lineVat` 호출 인자를 `r.taxable && !quote.zeroRated`로 바꿈. 견적 번호·유효 기간 코드는 그대로.

## 재현 테스트
- 위치: test/quote.test.js의 "견적 부가세는 ... (Q-0457)", "영세율 견적의 부가세는 0" (이미 있었음, 새로 추가하지 않음)
- 수정 전: 실패 (`node --test test/quote.test.js` → pass 2 / fail 2)
- 수정 후: 통과 (같은 명령 → pass 4 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: pass 46 / fail 9 (수정 전 pass 44 / fail 11)
- 실패 항목: 남은 9건(15,16,17,23,25,31,50,51,55)은 기준 커밋에서도 실패. 같은 원인(`computeTotals`의 `lineVat` 객체 전달, `total.js:31`)으로 보이나 비목표(청구서 계산 변경 금지)라 고치지 않음. 이번 수정 뒤 새로 실패한 항목은 없음.
