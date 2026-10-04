# fix: 선물하기 주문의 적립 포인트도 earnPoints로 계산한다

## 요약
선물하기 주문 G-0213의 적립 예정 포인트가 249P로 나오던 것을 고객센터 기준 218P로 바로잡는다.

## 원인
선물 주문(`src/gift/gift-order.js`)이 옛 식 `giftPoints`(배송비 포함, 반올림)를 써서, `earnPoints`(배송비 제외, 1P 미만 버림)를 쓰는 일반 주문과 식이 갈라졌다. 배송비가 0이고 1% 값이 정수인 주문에서는 같아 드러나지 않았다. G-0213은 배송비 3000원과 소수 때문에 249 vs 218로 달랐다.

## 변경
- `src/gift/gift-order.js`: `points.earned`를 `earnPoints(order)`로 계산
- `test/gift.test.js`: G-0213 재현 테스트 추가
- `docs/knowledge/points/gift-points-hands-off.md`: 선물 주문이 더는 `giftPoints`를 쓰지 않음을 기록
- `src/gift/gift-points.js`, `percentOf`, 영수증, 이미 저장된 주문은 건드리지 않았다 (다른 팀과 협의 전)

## 테스트
- `npm test`: 25개 통과
- G-0213 재현 명령: 수정 전 249, 수정 후 218
