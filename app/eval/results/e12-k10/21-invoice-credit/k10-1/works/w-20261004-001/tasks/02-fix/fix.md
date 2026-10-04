## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641원, total 29,079원
- 실제: vat 2,644원, total 29,082원

## 원인
- 원인: 부가세를 과세 공급가액 합계(26,438원)에 한 번만 `Math.round`로 계산해(2643.8 → 2644) 줄별 버림 규정과 달랐다. 반품 전표도 같은 방식이었다.
- 근거: `src/invoice/total.js:26`, `src/invoice/credit-note.js:90`이 `Math.round(taxable * 10 / 100)`를 썼다. 줄별 버림 536+633+325+837+310=2,641. 수정 뒤 CLI 출력이 2,641/29,079로 바뀌었다. 줄 금액이 모두 10의 배수면 두 방식이 같아 재현되지 않는다(기존 테스트가 통과한 이유).
- 사람 추정 판정: "반올림 문제 같다" — 맞음 — 합계에 한 번 반올림하는 것이 원인이다. 다만 고칠 방향은 반올림 방식 변경이 아니라 줄별 버림이다.
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 원 단위 버림 도우미 `floorPercentOf` 추가
- src/invoice/total.js — 과세 줄마다 공급가액의 부가세를 버림해 합산 (영세율은 0)
- src/invoice/credit-note.js — 반품 전표 부가세도 같은 줄별 버림. 할인 계산(`returnedDiscount`)은 비목표라 그대로 둠
- test/total.test.js, test/credit-note.test.js — 새 테스트 추가 (기존 테스트는 바꾸지 않음)

## 재현 테스트
- 위치: test/total.test.js (INV-2031, 할인 줄별 버림), test/credit-note.test.js (반품 전표 줄별 버림)
- 수정 전: 실패 (src를 되돌리고 `npm test`: 새 테스트 3개 not ok, 46 pass / 3 fail)
- 수정 후: 통과 (`npm test`: 49 pass / 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
