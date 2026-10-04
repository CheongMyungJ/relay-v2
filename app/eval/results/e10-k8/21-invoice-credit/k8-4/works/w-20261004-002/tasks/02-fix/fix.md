## 재현
- 재현 절차: 워크트리에서 `INV-2047.json`에 `CN-0112.json`의 returns를 적용해 `createCreditNote(inv, cn).totals`를 출력 (스크립트: /tmp/repro.mjs)
- 결과: 재현됨
- 기대: 줄별 공급가액 9236 + 6127 + 2075 = 17,438, 부가세 923 + 612 + 207 = 1,742, 합계 19,180
- 실제: 부가세 1,744, 합계 19,182

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계(17,438)에 `Math.round`를 한 번 적용해 부가세를 구했다. 회계팀 규칙은 줄별 버림 합이다.
- 근거: `src/invoice/credit-note.js:90` 수정 전 코드. 17438×10% = 1743.8 → 1744, 줄별은 923.6→923, 612.7→612, 207.5→207 = 1742. 수정 후 같은 스크립트가 1742 / 19180을 출력함. 줄 하나만 있고 줄 부가세가 정수인 전표는 차이가 없어 재현되지 않는 조건과도 맞는다.
- 사람 추정 판정: 없음 (intake handoff의 `returnedDiscount` 반올림 추정은 사람 의견이 아니라 AI 메모. 아래 기각 참조)
- 기각한 가설: `returnedDiscount`의 비율 할인 322.5원 반올림이 원인 — 이 반올림(→323)은 비목표(할인 계산 유지)이고, 줄 공급가액 6127은 그대로 두고도 규칙대로 부가세만 고치면 기대값이 나온다. 원인 아님.

## 변경 요약
- `src/money.js` — `floorPercentOf(amount, percent)` 추가(원 단위 버림). 이 브랜치에 아직 없었다(앞 Work w-20261004-001에서 추가될 수 있음).
- `src/invoice/credit-note.js` — `creditTotals`의 vat를 과세 줄마다 `floorPercentOf(net, 10)`을 구해 합산. 영세율은 0 유지, 면세 줄 제외.
- `test/credit-note.test.js` — 테스트 3개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/credit-note.test.js` 끝의 3개 테스트 (CN-0112 / 면세·영세율 / 줄별 버림)
- 수정 전: 실패 (`node --test test/credit-note.test.js` → CN-0112 테스트와 줄별 버림 테스트 not ok, vat 1744·1 기준)
- 수정 후: 통과 (`npm test` → 49 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
