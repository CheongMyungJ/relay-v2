## 재현
- 재현 절차: `examples/G-0213.json`을 `createGiftOrder`에 넣고 `points.earned`를 본다 (`node /tmp/r.mjs` 형태의 스크립트, 또는 `npm test`의 새 테스트)
- 결과: 재현됨
- 기대: 218P ((24,860 − 2,000 − 1,000) = 21,860의 1%, 버림)
- 실제: 249P (amounts.total 24,860의 1%를 반올림)

## 원인
- 원인: `giftPoints`가 `earnPoints`를 쓰지 않고 `percentOf(order.amounts.total, …)`(반올림, 쿠폰·포인트 차감 전 상품 금액 기준)로 따로 계산했다.
- 근거: `src/gift/gift-points.js` 수정 전 코드. 일반 주문은 `src/orders/order.js:35`에서 `earnPoints`를 쓴다. 이 total은 goods(24,860)와 같아(배송비·쿠폰·포인트 미반영) 24,860×1% = 248.6 → 반올림 249. 수정 후 218. 쿠폰·포인트가 없고 금액이 딱 떨어지는 주문(기존 테스트 300P)은 두 방식이 같아 드러나지 않았다.
- 사람 추정 판정: 포인트 계산은 `src/gift/gift-points.js` 쪽이라는 안내 — 맞음 — 해당 파일이 원인이었다.
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints`에 위임하게 해 일반 주문과 같은 기준(팀 지식 earn-basis.md)을 쓴다. `createGiftOrder`는 새 주문에서만 호출하므로 이미 적립된 값은 건드리지 않는다.
- test/gift.test.js — G-0213 재현 테스트 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/gift.test.js 마지막 테스트
- 수정 전: 실패 (`node --test` → expected 218, actual 249)
- 수정 후: 통과 (`node --test` 전체 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 전부 통과 (23개)
- 실패 항목: 없음
