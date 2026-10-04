## 재현
- 재현 절차: `examples/INV-2031.json`의 줄로 `createInvoice({customerId, lines})` 후 `computeTotals` 실행 (`node /tmp/r.mjs` 형태의 스크립트)
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: 부가세를 과세 공급가액 전체에 한 번만 `Math.round`해서 줄별 버림 합(회계팀 규정)보다 커졌다. 반품 전표도 같은 방식이고, 견적은 할인 전 금액과 할인액에 각각 반올림해 뺐다.
- 근거: `src/invoice/total.js:26`, `credit-note.js:90`, `quote.js:42-43`(수정 전). 줄별 버림 536+633+325+837+310=2,641. 수정 후 INV-2031 결과가 2,641/29,079로 바뀜. 수정 전 코드로 되돌리면 새 테스트 4개가 실패.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 전체 반올림이 줄별 버림과 달라서 생긴 차이다(반올림 → 버림, 줄 단위로 변경).
- 기각한 가설: 발행 청구서의 재계산 경로 — `invoiceTotals`/`creditNoteTotals`가 저장된 totals를 먼저 쓰고, `computeTotals`는 `issueInvoice`와 초안에서만 호출됨. 재계산 아님.

## 변경 요약
- `src/invoice/total.js` — 줄별 버림 합 도우미 `lineVatSum` 추가, `computeTotals`가 사용
- `src/invoice/credit-note.js` — `creditTotals`가 `lineVatSum` 사용 (`returnedDiscount`는 그대로)
- `src/invoice/quote.js` — `quoteTotals`가 `lineVatSum` 사용 (유효기간 등은 그대로)
- `src/format/`은 바뀌지 않음. 기존 테스트 변경 없음.

## 재현 테스트
- 위치: `test/vat-per-line.test.js` (INV-2031, 할인 줄, 면세·영세율, 반품, 견적, 청구서=견적 일치, 저장 totals 사용)
- 수정 전: 실패 — src만 되돌리고 `npm test`: 4개 실패(INV-2031, 할인 줄, 반품, 견적), 51 통과
- 수정 후: 통과 — `npm test`: 55 통과, 0 실패

## 테스트 실행
- 명령: `npm test`
- 결과: 55개 통과, 0 실패
- 실패 항목: 없음
