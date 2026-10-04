# 선물하기 적립 포인트를 일반 주문과 같은 규칙(배송비 제외, 원 단위 버림)으로 계산

## 요약
선물하기 주문의 적립 예정 포인트가 배송비를 포함해 반올림되던 것을 일반 주문과 같은 규칙으로 맞췄다. G-0213은 249P에서 218P가 된다.

## 원인
`giftPoints`가 배송비를 뺀 금액이 아니라 `amounts.total` 전체를 공용 `percentOf`(반올림)로 계산했다. 일반 주문의 `earnPoints`와 규칙이 달랐다.

## 변경
- `src/gift/gift-points.js`: `earnPoints`를 호출하도록 변경
- `test/gift.test.js`: G-0213(218P), 배송비 0원 버림 경계(35,050원 → 350P) 테스트 추가
- `docs/knowledge/points/earn-points-rule.md`: 선물하기를 규칙 미준수 목록에서 제거
- `percentOf`, `src/format/`, `refund.js`, 저장된 `points.earned`는 건드리지 않았다.

## 테스트
- `npm test`: 24개 통과
- G-0213 재현 명령: earned 218
