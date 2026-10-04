# fix: 선물하기 적립을 일반 주문과 같은 기준(배송비 제외, 원 단위 버림)으로 계산

## 요약
선물 주문 G-0213의 적립 예정 포인트가 218P여야 하는데 249P로 나오던 것을 고쳤다.

## 원인
`giftPoints`가 배송비를 포함한 `amounts.total`에 `percentOf`(반올림)를 적용해 일반 주문의 `earnPoints`와 기준이 달랐다.

## 변경
- `src/gift/gift-points.js`: `earnPoints`를 호출하도록 변경해 계산을 일반 주문과 공유
- `test/gift.test.js`: G-0213 = 218P 및 `earnPoints`와 동일함을 확인하는 테스트 추가
- `docs/knowledge/gift-points-hands-off.md`: 변경 이력 반영
- `percentOf`, earn.js, refund.js, src/format/은 변경 없음. 이미 저장된 주문은 재계산하지 않고 새 주문부터 적용

## 테스트
- `npm test`: 23 통과, 0 실패
- G-0213 재현 명령: earned 218 (수정 전 249)
- 주의: 선물하기 적립은 다른 팀과 같이 보는 영역이라 합의 여부 확인이 필요하다
