## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용해 `totals` 출력 (node 스크립트)
- 결과: 재현됨
- 기대: 줄별 버림 부가세 923+612+207 = 1,742, 환불 합계 19,180원
- 실제: vat 1,744, total 19,182원

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계(17,438)에 `Math.round(× 10 / 100)`을 적용해 부가세를 구했다. 규정은 줄마다 버림 후 합산이다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 vat 계산. 줄별 net 9,236 / 6,127 / 2,075 → 923.6 / 612.7 / 207.5 → 줄별 버림 합 1,742, 합계 반올림 1,744. 수정 후 실험에서 19,180으로 바뀜.
- 사람 추정 판정: 관련 코드는 `src/invoice/credit-note.js` — 맞음 — 위 위치에서 원인 확인
- 기각한 가설: `returnedDiscount`의 금액 할인 수량비 반올림이 원인 — 기각. CN-0112는 금액 할인 줄(OF-1342)을 전량 반품해 할인이 그대로이고, 어긋난 2원은 부가세에서 전부 설명된다.

## 변경 요약
- src/invoice/credit-note.js — 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)` 후 합산. 영세율은 0 유지, 면세 줄은 제외.
- test/credit-note.test.js — 테스트 2개 추가(기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js "부가세는 과세 줄마다 원 단위로 버림해 합한다 (CN-0112)"
- 수정 전: 실패 (`npm test` → fail 1, 이 테스트)
- 수정 후: 통과 (`npm test` → pass 48, fail 0)
- 면세 줄/영세율 테스트는 수정 전에도 통과하는 보호용 테스트

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음
