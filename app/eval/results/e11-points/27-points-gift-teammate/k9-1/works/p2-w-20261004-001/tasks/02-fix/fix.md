## 재현
- 재현 절차: `node src/cli.js examples/G-0213.json | grep 적립`
- 결과: 재현됨
- 기대: 218P (상품 24,860 − 쿠폰 2,000 − 포인트 1,000 = 21,860의 1% 버림)
- 실제: 249P

## 원인
- 원인: `giftPoints`가 배송비를 포함한 결제 금액 `amounts.total`에 반올림 `percentOf`를 적용했다. 일반 주문의 `earnPoints`는 배송비를 빼고 버림을 쓴다.
- 근거: `src/gift/gift-points.js`의 `percentOf(order.amounts.total, ...)`. G-0213은 total 24,860(배송비 3,000 포함)이라 249P. 수정 뒤 같은 명령이 218P. 배송비가 0인 기존 테스트(30,000원 → 300P)는 두 방식이 같아 통과했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — 자체 계산을 없애고 `earnPoints`에 위임. 기준 금액·버림·이미 적립된 값 재사용 규칙이 일반 주문과 하나로 맞는다.
- test/gift-points.test.js — 새 테스트 파일.

## 재현 테스트
- 위치: test/gift-points.test.js (G-0213 218P, 일반 주문과 동일, 저장된 적립값 사용)
- 수정 전: 실패 (`node --test test/gift-points.test.js` → fail 3, 기대 218 실제 249 등)
- 수정 후: 통과 (같은 명령, 전체 `npm test` 27개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 27개 통과, 0 실패
- 실패 항목: 없음
