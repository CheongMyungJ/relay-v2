# fix: 선물하기 적립 포인트를 상품·쿠폰·사용 포인트 기준 1% 내림으로 계산

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 고객센터 기준 218P로 맞춘다.

## 원인
`giftPoints`가 결제 금액(`amounts.total`)에 반올림 `percentOf`를 적용했다. 쿠폰·사용 포인트가 기준에서 빠지고 반올림까지 되어 어긋났다 (24,860 × 1% = 248.6 → 249).

## 변경
- `src/gift/gift-points.js`: 일반 주문의 `earnPoints`를 호출한다 (상품 − 쿠폰 − 사용 포인트의 1%, 내림, 배송비 제외).
- `docs/knowledge/points/earn-points-basis.md`: 선물하기도 같은 규칙을 따르도록 갱신.
- 공용 `percentOf`, 환불 회수, 메시지 카드·받는 사람·`src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 22개 모두 통과.
- `test/gift.test.js`에 G-0213 = 218P 재현 테스트 추가 (수정 전 249로 실패).
