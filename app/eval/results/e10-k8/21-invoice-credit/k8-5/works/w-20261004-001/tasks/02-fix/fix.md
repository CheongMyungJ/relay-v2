## 재현
- 재현 절차: `createInvoice({customerId, lines: examples/INV-2031.json의 lines})`를 `computeTotals`에 넣어 vat와 total을 출력 (examples JSON에는 taxType이 없어 createInvoice로 기본값을 채워야 함)
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 세율을 한 번 곱해 `Math.round`(2643.8→2644)했다. 회계팀 방식은 줄마다 버림(536+633+325+837+310=2641) 후 합산이라 합계 기준 반올림과 3원 차이가 난다.
- 근거: `src/invoice/total.js` 기존 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 수정 후 같은 명령이 2641/29079를 출력하고 테스트가 통과함.
- 사람 추정 판정: "반올림 문제 같다" — 부분적으로 맞음. 합계에 한 번 반올림하는 것이 원인이지만, 반올림 방식만이 아니라 계산 단위(합계 vs 줄별)와 버림 규칙이 함께 달랐다.
- 기각한 가설: `percentOf`(반올림) 사용 문제 — computeTotals는 `percentOf`를 쓰지 않고 직접 계산함. 반품 전표 영향 — `credit-note.js`는 자체 `creditTotals`를 쓰고 `computeTotals`를 호출하지 않아 영향 없음(범위 밖이므로 그대로 둠).

## 변경 요약
- `src/invoice/total.js` — 줄별 부가세 `lineVat`(할인 후 net × 세율, `Math.floor`)을 추가하고 과세 줄의 합을 vat로 사용. 면세 줄은 합산에서 제외, 영세율은 기존대로 0.
- `test/total.test.js` — 테스트 3개 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/total.test.js` — "부가세는 줄마다 원 단위 버림 후 합산한다 (INV-2031)", "할인된 줄 금액에 줄별로 부가세를 매기고, 면세 줄은 제외한다", "영세율 청구서는 줄별 계산에서도 부가세 0"
- 수정 전: 실패 (`npm test`: 47번 expected 2641 actual 2644, 48번 expected 210 actual 211)
- 수정 후: 통과 (`npm test`: 49 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패 (기존 46개 포함)
- 실패 항목: 없음
