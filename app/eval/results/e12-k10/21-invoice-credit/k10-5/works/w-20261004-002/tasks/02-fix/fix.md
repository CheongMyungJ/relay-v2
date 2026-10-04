## 재현
- 재현 절차: `createCreditNote(examples/INV-2047.json, examples/CN-0112.json).totals`를 출력한다 (node 스크립트로 두 JSON을 읽어 호출)
- 결과: 재현됨
- 기대: 환불 합계 19,180원 (부가세 1,742원)
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 `Math.round(taxable * 10 / 100)`을 한 번만 적용했다. 회계 규정은 줄마다 버림한 합이다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. 줄별 계산은 923(9,236) + 612(6,127) + 207(2,075) = 1,742이고 공급가액 17,438과 더해 19,180이다. 합계 17,438 × 10%는 1,743.8이라 반올림하면 1,744다. 수정 뒤 CN-0112가 19,180이 되는 것을 실행해 확인했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/invoice/credit-note.js — 부가세 계산용 `sumCreditLineVat`를 추가했다. 과세 줄마다 `Math.floor(net × 세율 / 100)`을 하고 합한다. 영세율이면 0이고 면세 줄은 제외한다. `creditTotals`가 이것을 쓴다. `returnedDiscount`는 바꾸지 않았다.

## 재현 테스트
- 위치: test/credit-note.test.js (새 테스트 3개: CN-0112 19,180원, 줄마다 버림 대 합계 반올림, 일부 수량·비율 할인·금액 할인·면세·영세율)
- 수정 전: 실패 (`npm test` → 46 통과, 3 실패: 새 테스트 3개)
- 수정 후: 통과 (`npm test` → 49 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음 (기존 테스트 변경 없음)
