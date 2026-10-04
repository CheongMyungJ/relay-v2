## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: 합계 29,079원 (공급가액 26,438 + 줄별 부가세 버림 합 2,641)
- 실제: vat 2,644, 합계 29,082원

## 원인
- 원인: 부가세를 줄마다가 아니라 과세 공급가액 합계에 한 번 곱해 `Math.round`로 반올림했다. 견적서는 할인 전 금액 합과 할인 합에 각각 반올림해 뺐다.
- 근거: `src/invoice/total.js`(vat 계산), `src/invoice/credit-note.js` creditTotals, `src/invoice/quote.js` quoteTotals. INV-2031은 26,438 × 10% = 2,643.8 → 2,644 (줄별 버림 합은 2,641). 수정 전 CLI 출력 29,082, 수정 후 29,079. 줄 부가세가 모두 10원 단위로 떨어지는 기존 테스트는 두 방식이 같아 통과했다.
- 사람 추정 판정: "반올림 문제 같다" — 맞음(부분적). 합계 반올림이 원인이 맞고, 올바른 규칙은 줄별 버림이다.
- 기각한 가설: 저장된 `totals` 재계산 경로 — `src/invoice/invoice.js:41`이 발행 후에는 저장된 totals를 그대로 쓰므로 영향 없음.

## 변경 요약
- src/money.js — `percentOfFloor`(원 단위 버림) 추가
- src/invoice/total.js — 부가세를 과세 줄마다 net에 버림 적용 후 합산
- src/invoice/credit-note.js — 반품 전표도 같은 규칙
- src/invoice/quote.js — 견적서도 줄별 net 기준 버림 합산 (기존: 할인 전 금액 기준 총액 계산). 사용하지 않게 된 `percentOf` import 제거
- 영세율·면세 줄은 그대로 0

## 재현 테스트
- 위치: test/total.test.js(INV-2031 29,079원), test/quote.test.js, test/credit-note.test.js (각 마지막 테스트)
- 수정 전: 실패 — 기준 소스로 되돌리고 `npm test`: 48 통과, 3 실패
- 수정 후: 통과 — `npm test`: 51 통과, 0 실패

## 테스트 실행
- 명령: `npm test`
- 결과: 51 통과, 0 실패
- 실패 항목: 없음
