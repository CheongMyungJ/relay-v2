## 재현
- 재현 절차: 레포 루트에서 `examples/`의 INV-2031, CN-0112(INV-2047에서 반품), Q-0457을 각각 `computeTotals` / `createCreditNote` / `createQuote`로 계산 (스크래치 스크립트)
- 결과: 재현됨
- 기대: INV-2031 부가세 2,641 / 합계 29,079, CN-0112 합계 19,180, Q-0457 합계 56,278
- 실제: INV-2031 부가세 2,644 / 합계 29,082, CN-0112 부가세 1,744 / 합계 19,182, Q-0457 부가세 3,589 / 합계 56,280

## 원인
- 원인: 청구서·반품 전표는 과세 공급가액 합계에 `Math.round`로 부가세를 한 번만 매기고, 견적서는 할인 전 금액 합과 할인 합에 각각 `percentOf`(반올림)를 적용해 뺐다. 줄별 버림이 아니라 합계 반올림이라 몇 원씩 커졌다.
- 근거: 수정 전 `src/invoice/total.js` vat 줄(`Math.round((taxable * VAT_RATE_PERCENT) / 100)`), `credit-note.js` creditTotals 동일, `quote.js` quoteTotals의 gross/discount 별도 반올림. 수정 전 위 실제 값 출력, 줄별 버림 적용 뒤 기대값과 일치(실험함).
- 사람 추정 판정: 반올림 문제로 보인다 — 맞음 — 합계에서 반올림(Math.round/percentOf)하는 것이 원인이고, 줄별 버림으로 바꾸자 해소됨.
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/tax-type.js` — `lineVat(net)` 추가: 할인 후 금액에 원 단위 버림으로 부가세 계산
- `src/invoice/total.js` — 부가세를 과세 줄별 `lineVat` 합으로 계산
- `src/invoice/credit-note.js` — 반품 전표 부가세도 같은 방식
- `src/invoice/quote.js` — 견적 부가세도 같은 방식(할인 전 금액 기준 계산 제거)
- 발행 청구서의 저장 합계 경로(`invoiceTotals`)와 `src/format/`은 건드리지 않음

## 재현 테스트
- 위치: `test/vat-per-line.test.js` (INV-2031, 할인 줄, 면세/영세율, 저장 합계 유지, CN-0112, Q-0457)
- 수정 전: 실패 — `node --test test/vat-per-line.test.js` → 6개 중 4개 실패(INV-2031, 할인 줄, CN-0112, Q-0457), 나머지 2개(면세/영세율, 저장 합계)는 회귀 방지용이라 통과
- 수정 후: 통과 — 같은 명령, 6개 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 54개 통과, 0개 실패 (기존 48 + 신규 6)
- 실패 항목: 없음
