## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용하고 `totals`를 출력한다 (`node /tmp/r.mjs` 형태의 스크립트).
- 결과: 재현됨
- 기대: `totals.total` 19,180원 (부가세 1,742)
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 10%를 곱해 `Math.round`로 한 번에 부가세를 구한다. 회계팀 규칙은 줄마다 할인 후 금액×10%를 버림해 더하는 것이다.
- 근거: `src/invoice/credit-note.js` 90행(수정 전). 줄별 순금액 9,236 / 6,127 / 2,075 → 버림 부가세 923+612+207 = 1,742, 17,438+1,742 = 19,180. 합계 방식은 1,743.8을 반올림해 1,744. 수정 후 19,180으로 확인했다(실험).
- 사람 추정 판정: 없음 (추가 의견은 회계팀 기대값 19,180원뿐이며 계산으로 일치 확인)
- 기각한 가설: `returnedDiscount`의 금액 할인 반올림이 원인 — CN-0112는 금액 할인 줄(OF-1342)을 전량 반품해 반올림 없이 청구서 할인 1,500이 그대로 쓰이고, 5% 할인 줄은 6,450×5%=322.5→323으로 supply 17,438이 회계팀 값과 일치하므로 차이는 부가세에만 있다.

## 변경 요약
- `src/invoice/total.js` — `lineVat(net, taxable)` 추가(버림, 면세 0). 이 브랜치에는 팀 지식이 말하는 `lineVat`이 없었다.
- `src/invoice/credit-note.js` — `creditTotals`의 부가세를 줄별 `lineVat` 합으로 변경. 영세율은 그대로 0. `creditNoteTotals`는 저장된 totals를 그대로 반환(변경 없음).
- `computeTotals`/`quoteTotals`는 요청 범위(반품 전표) 밖이고 저장된 청구서 금액 불변 제약이 있어 건드리지 않았다.

## 재현 테스트
- 위치: `test/credit-note.test.js` — "반품 전표 부가세는 과세 줄마다 원 단위 버림으로 더한다 (CN-0112)", "저장된 totals가 있으면 ... 다시 계산하지 않는다"(후자는 기존 동작 고정, 처음부터 통과)
- 수정 전: 실패 (`npm test` → fail 1, 부가세 1744 대 1742)
- 수정 후: 통과 (`npm test` → pass 50, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0 실패. `src/format/` 변경 없음
- 실패 항목: 없음
