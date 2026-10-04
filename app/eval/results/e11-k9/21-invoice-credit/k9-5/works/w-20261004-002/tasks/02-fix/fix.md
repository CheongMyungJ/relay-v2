## 재현
- 재현 절차: `createCreditNote(INV-2047, CN-0112)`를 `examples/` 두 파일로 호출해 `totals`를 출력한다 (`node`로 `src/invoice/credit-note.js` import).
- 결과: 재현됨
- 기대: 줄마다 버림 규칙으로 부가세 923+612+207 = 1,742원, 공급가액 17,438원, 합계 19,180원
- 실제: 부가세 1,744원, 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세 공급가액 합에 세율을 곱해 `Math.round`로 부가세를 계산했다(줄마다 버림 규칙 위반).
- 근거: `src/invoice/credit-note.js` 118행 부근 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 17,438×10% = 1,743.8 → 1,744. 줄별 버림은 923.6→923, 612.7→612, 207.5→207 = 1,742. 수정 뒤 출력이 1,742/19,180으로 바뀜을 확인(실험). 기존 테스트 값(580, 290 등)은 줄 부가세가 정수라 두 방식이 같아 재현되지 않는다.
- 사람 추정 판정: 없음 (추가 의견은 코드 위치 안내뿐이며 위치가 맞음)
- 기각한 가설: 할인 반올림(`returnedDiscount`/`percentOf`)이 원인 — 형광펜 5% 할인 322.5가 323으로 반올림되나, 청구서와 같은 규칙이고 지식 규칙이 할인 반올림을 바꾸라고 하지 않으며, 버림으로 바꿔도 줄 부가세(612)는 같다.

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)` 후 합산으로 변경. 영세율은 0 유지. `creditNoteTotals`(저장된 totals 우선)는 그대로.
- test/credit-note.test.js — 테스트 2개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js `CN-0112: 부가세는 줄마다 버림 후 합산한다 (회계팀 기준)`, 저장 금액 유지 테스트
- 수정 전: 실패 (`npm test` → fail 1, vat 1744 vs 기대 1742)
- 수정 후: 통과 (`npm test` → 48 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0 실패
- 실패 항목: 없음
