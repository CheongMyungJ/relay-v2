# 적립 포인트를 배송비 제외, 소수점 버림 기준으로 계산

## 요약
적립 예정 포인트가 고객센터 안내와 달랐다. 이제 (상품 금액 − 쿠폰 − 사용 포인트)의 1%를 버림하고 배송비는 뺀다. O-1042는 268P → 237P, G-0213은 249P → 218P가 된다.

## 원인
적립과 선물하기 적립이 배송비가 들어간 `amounts.total`에 반올림(`percentOf`)을 적용했고, 환불 회수도 반올림이었다.

## 변경
- `src/points/earn.js`: 배송비 제외, 버림으로 계산
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 부분 환불 회수를 환불 전후 남은 주문 적립의 차이로 계산(버림, 분할 환불 합계 일치)
- `src/money.js`: `floorPercentOf` 추가
- `docs/knowledge/points/earn-basis.md`: 적립 기준 규칙 기록
- 저장된 `points.earned`, ledger, `src/format/`은 바꾸지 않음

## 테스트
- `npm test`: 26 통과, 0 실패 (재현 테스트 추가)
- `node src/cli.js examples/O-1042.json` → 237P, `examples/G-0213.json` → 218P
