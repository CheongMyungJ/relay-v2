## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합(26,438)에 10%를 한 번 곱해 `Math.round`한다(2643.8 → 2644). 회계팀 기준은 줄마다 버림(536+633+325+837+310 = 2,641)이라 몇 원 크게 나온다. 반품 전표 `creditTotals`에도 같은 복사 코드가 있었다.
- 근거: `src/invoice/total.js`의 `vat` 계산(수정 전), `src/invoice/credit-note.js`의 `creditTotals`. 수정 전 CLI 출력 2,644. 수정 뒤 2,641로 바뀌는 것을 확인했다. 줄 금액이 10원 단위로 딱 떨어지거나 줄이 하나이면 합계 반올림과 줄별 버림이 같아 재현되지 않는다.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계에서 한 번 반올림하는 것이 원인이다. 다만 반올림을 버림으로 바꾸는 것만으로는 부족하고(합계에서 버림하면 2,643), 줄별 계산이 필요하다. "반품 전표·내보내기도 같은 규칙인지" — 반품 전표는 맞음(복사 코드), 내보내기(`src/export/*`)는 틀림(저장된 `totals.vat`만 읽고 직접 계산하지 않는다).
- 기각한 가설: 할인 적용 순서 문제 — 할인은 이미 줄별로 부가세 전에 적용되고 있어 기각. 합계에서 `Math.floor`로 바꾸기 — 2,643이라 기대값과 다르다.

## 변경 요약
- src/invoice/total.js — `lineVat`(줄별 버림), `vatOfRows`(과세 줄만 합산) 추가. `computeTotals`가 이를 쓴다. 영세율은 계속 0.
- src/invoice/credit-note.js — `creditTotals`도 `vatOfRows`를 쓰도록 변경(사람 결정: 함께 고침). 미사용이 된 `VAT_RATE_PERCENT` import 제거.
- test/total.test.js, test/credit-note.test.js — 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/total.test.js (INV-2031 줄별 버림, 할인 후 금액 기준, 면세 줄), test/credit-note.test.js (반품 전표 줄별 버림). 영세율 0은 기존 테스트가 확인한다.
- 수정 전: 실패 (src를 되돌리고 `npm test`: 새 테스트 4건 실패, 46건 통과)
- 수정 후: 통과 (`npm test`: 50건 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 통과, 0 실패
- 실패 항목: 없음
