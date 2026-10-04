## 재현
- 재현 절차: `examples/INV-2047.json`과 `examples/CN-0112.json`으로 `createCreditNote(invoice, data).totals`를 출력
- 결과: 재현됨
- 기대: 환불 합계 19,180원 (회계팀)
- 실제: `{ supply: 17438, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 부가세를 과세분 합계(17,438)에 한 번만 곱해 반올림(1,744)했다. 규정은 줄마다 버림한 합이다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. 줄별 공급가액 9,236·6,127·2,075 → 부가세 923+612+207=1,742, 합계 19,180으로 회계팀 값과 일치. 수정 뒤 실제 출력도 19,180.
- 사람 추정 판정: 없음
- 기각한 가설: 없음 (직전 handoff의 "과세분 전체에 한 번 반올림" 가설은 확인되어 원인으로 채택)

## 변경 요약
- src/invoice/total.js — `lineVatSum(rows, zeroRated)` 추가(줄별 버림 합, 영세율 0). 기준 브랜치에 없던 도우미라 새로 만듦
- src/invoice/credit-note.js — `creditTotals`의 부가세를 `lineVatSum`으로 계산. 저장된 `totals`를 쓰는 `creditNoteTotals`는 그대로
- test/credit-note.test.js — 회귀 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js '부가세는 줄마다 버림한 합이다 (CN-0112)'
- 수정 전: 실패 (`node --test test/credit-note.test.js`, src 변경을 되돌린 상태에서 1건 실패, 19182 ≠ 19180)
- 수정 후: 통과 (같은 명령 6건 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 49건 통과, 0건 실패
- 실패 항목: 없음
