# 적립률 1%에서 2%로 변경, 환불 회수는 옛 주문의 적립률로 계산

## 요약
기본 적립률을 2%로 올린다. 새 주문부터 적용하고 저장된 포인트와 영수증 출력은 바꾸지 않는다. 고객센터 예시 O-1107은 486P가 적립된다.

## 원인
`POINT_RATE_PERCENT`가 1이었고, 적립 계산이 배송비를 포함한 결제 금액에 곱해 반올림했다. 상수만 2로 바꾸면 O-1107이 546P가 되어 팀 규칙(배송비 제외, 원 단위 버림)과 어긋난다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT` 1 → 2, 옛 주문용 `LEGACY_POINT_RATE_PERCENT` 추가
- `src/points/earn.js`: `earnBase`/`earnFromBase`/`earnedRatePercent` 추가, 적립은 상품−쿠폰−사용 포인트 기준
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 회수 = 원 적립 − 남은 상품 재계산 적립. 옛 1% 저장 주문은 1%로 재계산해 음수 회수를 막음
- `docs/knowledge/points/`: 적립·환불 회수 규칙 갱신
- `src/format/`은 변경 없음

## 테스트
- `npm test`: 25개 통과
- `node src/cli.js examples/O-1107.json` → 적립 예정 486P
- `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 회수 132P(음수 아님)
- 기존 테스트 3개 파일은 기대값만 2% 기준으로 바꿈
- 알려진 한계: 반복 부분 환불의 회수 중복, 새 비율로 환불 회수를 계산할지는 정산팀과 따로 정함
