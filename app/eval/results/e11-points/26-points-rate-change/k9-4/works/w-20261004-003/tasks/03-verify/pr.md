# 적립률 2%로 올리고 적립 기준에서 배송비 제외, 1P 미만 버림

## 요약
기본 적립률을 1%에서 2%로 올린다(2026-10-04 배포부터). 적립 기준은 상품 금액 − 쿠폰 − 사용 포인트이고 배송비는 뺀다. 1P 미만은 버린다. O-1107은 486P가 적립된다. 환불 회수 결과는 달라지지 않는다.

## 원인
적립이 배송비가 든 `amounts.total`을 `percentOf`(반올림)로 계산했고, 환불 회수도 `POINT_RATE_PERCENT`를 직접 썼다. 비율만 2로 바꾸면 O-1107이 546P가 되고 환불 회수도 2%로 바뀐다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT=2`, 환불 전용 `REFUND_RECOVER_RATE_PERCENT=1` 추가
- `src/points/earn.js`: `earnBase`, `pointsOf`(버림) 추가
- `src/gift/gift-points.js`: `earnPoints`를 써서 선물하기도 같은 규칙
- `src/orders/refund.js`: 회수 비율을 `REFUND_RECOVER_RATE_PERCENT`로 분리
- `docs/knowledge/points/`: 적립 규칙 갱신, 환불 회수 비율 항목 추가
- `src/format/`, 저장된 `points.earned`를 쓰는 `cancelOrder`는 변경 없음

## 테스트
- `npm test`: 21 pass, 0 fail
- 새 테스트: O-1107 486P. 기존 기대값 변경 2건(order 500→1000, gift 300→600)은 1%→2% 반영이라 약화 아님
- `examples/R-0311.json` 환불 출력은 기준 커밋과 같다(-131P)
