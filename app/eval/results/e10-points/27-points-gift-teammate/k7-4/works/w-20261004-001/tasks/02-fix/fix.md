## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P

## 원인
- 원인: `earnPoints`가 결제 금액(`amounts.total`, 배송비 포함)에 `percentOf`(Math.round)를 적용했다. 규칙은 배송비 제외 금액의 1%, 버림이다.
- 근거: `src/points/earn.js:6` (수정 전). O-1042는 total 26,770 → 267.7 → 반올림 268. 규칙대로 28,270 - 3,000 - 1,500 = 23,770 → 237.7 → 버림 237. 수정 뒤 CLI가 237P를 출력함. 배송비가 없는(무료배송) 주문은 total과 같아 기존 테스트(O-0002, 500P)가 영향받지 않아 버그가 드러나지 않았다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/points/earn.js — 적립을 (goods - coupon - pointsUsed) × 1% 로 계산하고 Math.floor로 버림. `percentOf` 의존 제거.
- test/earn.test.js — 신규 테스트 3개 추가.

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`node --test test/earn.test.js` → pass 0, fail 3)
- 수정 후: 통과 (같은 명령 → pass 3, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0개 실패 (기존 20 + 신규 3)
- 실패 항목: 없음
