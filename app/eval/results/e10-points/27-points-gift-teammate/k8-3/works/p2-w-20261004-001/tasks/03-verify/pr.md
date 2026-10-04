# fix: 선물하기 주문 적립을 일반 주문과 같은 earnPoints로 계산한다

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을, 일반 주문과 같은 기준(배송비 제외, 1P 미만 버림)인 218P로 고친다.

## 원인
`createGiftOrder`가 배송비를 포함한 금액에 `percentOf` 반올림을 쓰는 `giftPoints`로 적립을 계산해서 일반 주문의 `earnPoints`와 기준이 달랐다.

## 변경
- `src/gift/gift-order.js`: 적립 계산을 `giftPoints`에서 `earnPoints`로 바꿨다.
- `test/gift.test.js`: G-0213 재현 테스트를 추가했다.
- `docs/knowledge/`: 선물하기 적립 현황을 갱신했다.
- `src/gift/gift-points.js`, `src/money.js`, `src/format/`은 팀 규칙에 따라 수정하지 않았다. `giftPoints`는 호출처가 없어졌지만 export는 남아 있다.

## 테스트
- `npm test`: 24개 통과, 0개 실패
- G-0213: 선물 주문과 일반 주문 모두 218P
