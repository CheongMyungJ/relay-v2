# 적립 포인트를 쿠폰·사용 포인트를 뺀 상품 금액 기준으로 내림 계산

## 요약
O-1042의 적립 예정 포인트가 268P로 나오던 것을 적립 안내대로 237P로 바로잡았다. 선물하기와 부분 환불 회수도 같은 기준을 따른다.

## 원인
적립 기준이 배송비를 포함한 결제 금액이었고 반올림을 썼다. 기준은 상품 금액 - 쿠폰 - 사용 포인트(배송비 제외)이고 1P 미만은 내림이어야 한다 (23,770원 × 1% = 237.7 → 237).

## 변경
- `src/points/earn.js`: `earnBase` 추가, 내림 계산
- `src/gift/gift-points.js`: `earnPoints` 재사용
- `src/orders/refund.js`: 부분 환불 회수를 환불 전·후 적립의 차이로 계산
- `docs/knowledge/points/earn-rule.md`: 적립 규칙 기록
- 적립률(`POINT_RATE_PERCENT`)은 그대로

## 테스트
- `npm test`: 27 통과, 0 실패
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
- 새 테스트: `test/earn.test.js`, `test/refund.test.js`(O-1077/R-0311)
