## 재현
- 재현 절차: `examples/INV-2031.json`을 `createInvoice` → `computeTotals`에 넣어 출력 (`node /tmp/r.mjs`)
- 결과: 재현됨
- 기대: vat 2,641, total 29,079
- 실제: vat 2,644, total 29,082

## 원인
- 원인: 부가세를 과세 공급가 합계에 한 번 곱해 반올림(`Math.round`)해서, 줄별 버림 합산(회계팀 규칙)보다 커진다.
- 근거: `src/invoice/total.js:28` 수정 전 코드. 수정 후 같은 입력이 2,641 / 29,079로 나옴(실험 확인).
- 사람 추정 판정: "반올림 문제 같다" — 맞음 — 합계 기준 `Math.round`가 원인. "코드 위치는 total.js" — 맞음.
- 기각한 가설: 합계 단위 버림 — 2,643원, 합계 29,081원이라 회계팀 29,079원과 다름 (t-01에서 기각)

## 변경 요약
- src/invoice/total.js — vat를 과세 줄마다 `Math.floor(net*10/100)`한 값의 합으로 계산. 영세율은 0, 면세 줄은 제외 유지.
- test/total.test.js — 테스트 2개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/total.test.js의 "부가세는 과세 줄마다 …(INV-2031)", "줄별 버림 부가세는 할인 후 금액 기준…"
- 수정 전: 실패 (`npm test` → pass 46, fail 2)
- 수정 후: 통과 (`npm test` → pass 48, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0 실패
- 실패 항목: 없음
