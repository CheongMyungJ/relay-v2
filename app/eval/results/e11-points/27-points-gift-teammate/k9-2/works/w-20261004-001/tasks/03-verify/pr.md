# 적립 포인트를 배송비 제외 결제 금액 기준으로 내림 계산

## 요약
주문의 적립 예정 포인트가 고객센터 계산보다 많게 나오던 버그를 고친다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)의 1%를 반올림했다. 고객센터 기준은 배송비를 뺀 금액의 1%를 내림한 값이다.

## 변경
- `src/points/earn.js`: `(total - shipping)`의 1%를 `Math.floor`로 내린다.
- `test/earn.test.js`: O-1042(237P), O-1107(243P), 배송비 없는 주문(500P) 테스트를 추가했다.
- `docs/knowledge/points/earn-rule.md`: 적립 규칙과 아직 따르지 않는 곳(선물하기 적립, 부분 환불 회수)을 남겼다.
- 선물하기 적립, 영수증 글자, 저장된 `points.earned`는 건드리지 않았다.

## 테스트
- `npm test`: 23개 통과
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
