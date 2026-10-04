## 재현
- 재현 절차: 워크트리에서 `createCreditNote(INV-2047, CN-0112)`를 만들어 `totals`를 본다. (`examples/INV-2047.json`, `examples/CN-0112.json`을 읽어 `src/invoice/credit-note.js`의 `createCreditNote`에 넘김)
- 결과: 재현됨
- 기대: 줄별 버림 부가세 923 + 612 + 207 = 1,742원, 환불 합계 17,438 + 1,742 = 19,180원
- 실제: 부가세 1,744원, 환불 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계(17,438)에 한 번 `Math.round`해서 부가세를 구한다. 팀 규칙은 줄마다 `Math.floor`한 값의 합이다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 줄별 net은 9,236 / 6,127 / 2,075로 줄별 버림은 923 / 612 / 207이고 합은 1,742다. 합계 반올림은 1,743.8을 반올림한 1,744다. 수정 뒤 테스트가 통과하는 것으로 확인했다. 줄이 하나이거나 줄별 소수 부분 합이 0.5 미만이면 두 방식이 같아서 어긋나지 않는다.
- 사람 추정 판정: 없음 (추가 의견은 규칙이 반품 전표에도 적용되는지 확인하는 질문이었고, 적용되는 것으로 진행함)
- 기각한 가설: 반품 줄 할인 반올림(`returnedDiscount`)이 원인 — 반품 줄 할인은 6,450원의 5%가 322.5원이라 323원이 되지만, 팀 규칙은 부가세 계산만 다루고 할인 반올림은 규칙에 없다. 회계팀 방식과 같은지 확인할 수 없어 바꾸지 않았다. 이 줄이 19,182와 19,180의 차이를 설명하지는 않는다.

## 변경 요약
- `src/invoice/credit-note.js` — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)`한 값의 합으로 바꿨다. 영세율은 0 그대로다. 저장된 `totals`를 쓰는 `creditNoteTotals`는 건드리지 않았다.
- `test/credit-note.test.js` — 테스트 2개 추가. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: `test/credit-note.test.js` "CN-0112: 부가세는 과세 줄마다 버림해서 합한다". 저장된 금액을 쓰는지 확인하는 테스트도 추가했다.
- 수정 전: 실패 (`src`를 기준 커밋으로 되돌리고 `npm test`: pass 47, fail 1, vat 1744)
- 수정 후: 통과 (`npm test`: pass 48, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음
