# fix: 선물하기 적립 포인트를 일반 주문 적립 규칙(earnPoints)으로 계산

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 고객센터 계산과 같은 218P로 바로잡는다.

## 원인
`giftPoints`가 `earnPoints`를 쓰지 않고 배송비 포함 `amounts.total`에 `percentOf`(반올림)를 적용했다. 규칙은 (상품금액 − 쿠폰 − 사용 포인트)의 적립률에서 소수점 버림이고 배송비는 뺀다.

## 변경
- `src/gift/gift-points.js`: `giftPoints`가 `earnPoints(order)`를 호출
- `test/gift.test.js`: G-0213 재현 테스트 추가
- `docs/knowledge/points/earn-rule.md`: 선물하기 적용 현황 갱신
- 이미 적립된 포인트, 메시지 카드, 받는 사람 정보, `src/format/`은 바꾸지 않음
- 주의: 선물하기에 이 규칙을 적용하는 것은 다른 팀과 합의가 확인되지 않았다. 배송비가 있는 선물 주문은 적립이 이전보다 줄어든다.

## 테스트
- `npm test`: 25개 통과
- `node src/cli.js examples/G-0213.json`: 적립 예정 218P
- 수정 전 코드에서는 새 테스트가 실패(expected 218, actual 249)
