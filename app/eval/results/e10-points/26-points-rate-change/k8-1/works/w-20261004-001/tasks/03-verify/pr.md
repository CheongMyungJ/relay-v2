# 적립 포인트를 상품-쿠폰-사용 포인트 기준으로 버림 계산

## 요약
적립 예정 포인트를 규정대로 (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림으로 계산한다. O-1042는 268P에서 237P가 된다. 선물하기도 같은 규정을 쓴다.

## 원인
`earnPoints`가 결제 금액(배송비 포함)을 기준으로 반올림해 계산했다. `giftPoints`는 같은 식을 복사해 쓰고 있었다.

## 변경
- `src/points/earn.js`: 기준 금액을 goods − coupon − pointsUsed로 바꾸고 `Math.floor`로 버린다.
- `src/gift/gift-points.js`: `earnPoints`에 위임한다.
- `test/earn.test.js`: 규정 테스트 5개 추가.
- `docs/knowledge/points/`: 적립 규정과 부분 환불 회수 불일치를 기록.
- 부분 환불 회수식(`refund.js`)은 이 PR에서 바꾸지 않았다.

## 테스트
- `node src/cli.js examples/O-1042.json` → 237P
- `npm test` → 25 pass, 0 fail
