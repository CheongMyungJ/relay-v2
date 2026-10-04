# fix: 선물하기 적립을 일반 주문 earnPoints와 같은 기준으로 계산한다

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 고객센터 값인 218P로 바로잡는다.

## 원인
`giftPoints`가 배송비를 포함한 `amounts.total`을 `percentOf`(반올림)로 계산해, 배송비를 빼고 1P 단위로 버리는 일반 주문 `earnPoints`와 기준이 달랐다. 배송비가 없는 주문은 값이 같아 기존 테스트가 잡지 못했다.

## 변경
- `src/gift/gift-points.js`: `giftPoints`가 `earnPoints(order)`를 호출한다.
- `percentOf`, `gift-order.js`, `earn.js`, `refund.js`, `amounts` 계산, 영수증 코드는 바꾸지 않았다. 저장된 주문의 `points.earned`는 다시 계산하지 않는다.
- `docs/knowledge/gift-points-shared-with-other-team.md`: 이번 변경 이력을 추가했다.
- 주의: 선물하기 적립 코드는 다른 팀과 같이 보는 곳이다. 합의는 확인되지 않았으니 머지 전에 확인이 필요하다.

## 테스트
- `npm test`: 26 pass, 0 fail
- `test/gift.test.js`에 배송비 있는 G-0213(218P)과 배송비 없는 주문(319P)이 `earnPoints`와 같다는 테스트 2개를 추가했다.
