# 선물하기 주문 적립 포인트도 일반 주문과 같은 규칙으로 계산

## 요약
선물하기 주문 G-0213의 적립 포인트가 249P로 나오던 것을 고객센터 기준 218P로 맞춘다.

## 원인
`giftPoints`가 배송비를 포함한 `amounts.total`에 공용 `percentOf`(반올림)를 써서, 일반 주문의 `earnPoints`(배송비 제외, 버림)와 규칙이 달랐다. 기존 테스트는 배송비 0, 원 단위 미만 없는 금액이라 드러나지 않았다.

## 변경
- `src/gift/gift-points.js`: `earnPoints`를 그대로 사용
- `test/gift.test.js`: G-0213 218P 테스트, 일반 주문과 적립이 같은지 비교하는 테스트 추가
- `docs/knowledge/points/earn-points-rule.md`: 선물하기를 규칙을 따르는 곳으로 갱신

메시지, 받는 사람, amounts, 영수증 코드와 저장된 `points.earned`는 건드리지 않았다.

## 테스트
- `npm test`: 23개 통과
- G-0213 재현 명령: `earned: 218`
- 수정 전 코드에서 새 테스트 2개가 실패함을 확인(fix 단계)
