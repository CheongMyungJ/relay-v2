## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용하고 `totals`를 출력한다 (`node -e "import('./src/invoice/credit-note.js')..."`).
- 결과: 재현됨
- 기대: 줄별 공급가액 9,236 / 6,127 / 2,075 → 줄별 부가세 버림 923+612+207 = 1,742원, 합계 19,180원
- 실제: 부가세 1,744원(과세 공급가액 합 17,438 × 10%를 한 번 반올림), 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 부가세를 한 번 `Math.round`로 계산해, 줄마다 버림 후 합산하는 회계 규칙과 어긋났다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals` 원래 `Math.round((taxable * VAT_RATE_PERCENT) / 100)` = round(1743.8) = 1,744. 줄별 버림이면 1,742. 줄별 합과 합계 반올림이 갈리는 경우에만 어긋나므로 몇 원씩 차이가 난다. 수정 후 1,742로 바뀌는 것을 확인했다.
- 사람 추정 판정: 없음
- 기각한 가설: 할인 계산(`returnedDiscount`)이 원인 — 줄별 net(9,236 / 6,127 / 2,075)은 규칙대로이고 부가세 단계에서만 차이가 난다.

## 변경 요약
- `src/invoice/credit-note.js` — 부가세를 과세 줄마다 net에 원 단위 버림으로 계산해 합산. 영세율은 0, 면세 줄은 제외. `creditNoteTotals`는 이미 저장된 `totals`를 그대로 반환하므로 변경 없음. 청구서·견적 코드와 `src/format/`은 건드리지 않음.
- `test/credit-note.test.js` — 테스트 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: `test/credit-note.test.js` "부가세는 줄마다 버림으로 계산해 합산한다 (CN-0112)", "영세율 반품 전표의 부가세는 0원이고, 저장된 합계는 다시 계산하지 않는다"
- 수정 전: 실패 (src를 되돌리고 `npm test`: CN-0112 테스트 not ok, 1,744 ≠ 1,742)
- 수정 후: 통과 (`npm test`: pass 50, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
