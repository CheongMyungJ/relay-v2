# fix: 선물하기 적립을 일반 주문과 같은 기준(배송비 제외, 원 단위 버림)으로 계산

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 고객센터 기준 218P가 아니라 249P로 나오던 문제를 고쳤다.

## 원인
`giftPoints`가 배송비 3,000원이 포함된 `amounts.total`(24,860)에 반올림 `percentOf`를 적용했다. 적립 기준은 (상품 − 쿠폰 − 사용 포인트, 배송비 제외)의 1%를 원 단위로 버림이다.

## 변경
- `src/gift/gift-points.js`: `earnPoints`를 재사용한다.
- `test/gift.test.js`: G-0213 적립 테스트를 추가했다.
- `docs/knowledge/`: 적립 계산 규칙과 복제 위치 지식을 남겼다.
- 비목표: 부분 환불 회수(`refund.js`), `percentOf`, 메시지 카드·받는 사람·`src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 24개 통과
- `node src/cli.js examples/G-0213.json`: 적립 예정 218P (수정 전 249P). 영수증의 다른 줄은 같다.
