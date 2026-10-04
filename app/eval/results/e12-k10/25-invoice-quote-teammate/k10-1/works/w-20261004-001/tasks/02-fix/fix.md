## 재현
- 재현 절차: `node /tmp/r.mjs examples/INV-2031.json` (createInvoice → computeTotals 출력). 또는 INV-2031 품목으로 `computeTotals` 호출
- 결과: 재현됨
- 기대: 부가세 2,641원, 합계 29,079원
- 실제: 부가세 2,644원, 합계 29,082원

## 원인
- 원인: 부가세를 줄별이 아니라 과세 공급가액 합계에 한 번 `Math.round`로 계산했다(청구서·대변전표). 견적은 할인 전 총액과 할인 총액 각각에 `percentOf`(반올림)를 적용해 뺐다. 규정(줄별 버림 합산)과 다르다.
- 근거: `src/invoice/total.js:26`, `src/invoice/credit-note.js:90`, `src/invoice/quote.js:40-44`(수정 전). 수정 후 INV-2031이 2,641/29,079로 나옴. 수정 전 코드로 되돌리면 새 테스트 4개가 실패.
- 사람 추정 판정: "반올림 문제로 합계가 회계팀 계산보다 크게 나온다" — 맞음. 합계 단위 반올림(26,438×10% = 2,643.8 → 2,644)과 줄별 버림(2,641)의 차이다. 다만 INV-2031은 3원 차이로 "크게"는 아니고, 줄별로 버림하면 합계 반올림보다 작거나 같아진다.
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — `vatOfLines(nets, percent)` 추가: 줄 금액마다 `Math.floor`로 버림해 합산
- `src/invoice/total.js`, `src/invoice/credit-note.js` — 과세 줄의 net(할인 후)에 `vatOfLines` 적용. 영세율은 계속 0, 면세 줄은 제외
- `src/invoice/quote.js` — 총액 기준 반올림 차감 방식을 같은 `vatOfLines`로 교체, 주석 갱신
- 기존 테스트 변경 없음. `src/format/` 변경 없음. 발행 청구서는 `invoiceTotals`/`creditNoteTotals`가 저장된 합계를 쓰고, export(`ledger`, `monthly`, `invoices-csv`)도 저장 합계를 읽으므로 영향 없음(코드 확인).

## 재현 테스트
- 위치: `test/total.test.js`(INV-2031, 할인·면세), `test/quote.test.js`, `test/credit-note.test.js` 각 1개 이상 추가
- 수정 전: 실패 — `src`만 수정 전으로 되돌리고 `npm test`: 4개 실패(not ok 6, 45, 51, 52)
- 수정 후: 통과 — `npm test`: 52 pass, 0 fail

## 테스트 실행
- 명령: `npm test`
- 결과: 52 pass / 0 fail
- 실패 항목: 없음 (기준 커밋에서는 기존 48개 모두 통과)
