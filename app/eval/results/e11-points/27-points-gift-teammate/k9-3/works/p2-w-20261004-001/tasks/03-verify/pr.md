# 선물하기 적립 포인트도 일반 주문과 같이 배송비를 빼고 소수는 버린다

## 요약
선물 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 고객센터 계산인 218P로 고쳤다.

## 원인
`giftPoints`가 배송비가 포함된 `amounts.total`에 `percentOf`(반올림)를 써서, 배송비를 빼고 버림하는 일반 주문 `earnPoints`와 달랐다.

## 변경
- `src/gift/gift-points.js`: 자체 계산을 없애고 `earnPoints`를 호출
- `docs/knowledge/points/earn-base-and-rounding.md`: 선물하기 반영, 해결된 항목 정리
- 저장된 `points.earned` 재계산 코드, `src/format/`은 바꾸지 않음

## 테스트
- `npm test` 24개 통과
- `test/gift.test.js`에 G-0213 218P, 같은 금액 일반 주문과 동일 값 테스트 추가
