# fix: 적립 예정 포인트를 배송비 제외 기준, 소수점 버림으로 계산

## 요약
O-1042의 적립 예정 포인트가 안내(237P)와 달리 268P로 나오던 문제를 고쳤다.

## 원인
`earnPoints`가 배송비가 포함된 `order.amounts.total`(26,770원)에 반올림(`percentOf`)을 적용했다.

## 변경
- `src/points/earn.js`: 기준 금액을 상품금액 − 쿠폰 − 사용 포인트로, 끝수 처리를 `Math.floor`로 바꿨다.
- `percentOf`는 선물하기 적립과 환불 회수가 같이 쓰므로 바꾸지 않았다.
- `docs/knowledge/points/earn-rule.md`: 적립 규칙과 선물하기 미정 사항을 남겼다.
- 저장된 `points.earned`, `src/format/`, `src/gift/`는 바뀌지 않는다.

## 테스트
- `npm test`: 24개 통과
- `node src/cli.js examples/O-1042.json | grep 적립` → 237P
- 신규 `test/earn.test.js` 4개 (O-1042, 배송비 무료, 소수점 버림, 배송비 제외)
