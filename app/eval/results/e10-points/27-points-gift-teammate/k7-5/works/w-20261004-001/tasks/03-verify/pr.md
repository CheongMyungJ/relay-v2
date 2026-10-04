# fix: 일반 주문 적립을 배송비 제외 금액 기준, 원 단위 버림으로 계산

## 요약
O-1042의 적립 예정이 고객센터 계산(237P)보다 많은 268P로 나오던 버그를 고친다.

## 원인
`earnPoints`가 배송비가 포함된 `amounts.total`에 `percentOf`(반올림)를 써서 배송비가 있는 주문의 적립이 많았다.

## 변경
- `src/points/earn.js`: `(total - shipping)`의 `POINT_RATE_PERCENT`%를 원 단위로 버린다.
- `src/format/`, `src/gift/gift-points.js`, `percentOf`, 저장된 `points.earned`는 건드리지 않았다.
- `docs/knowledge/`에 적립 규칙과 팀 지식을 남겼다.

## 테스트
- `npm test` 22개 통과
- `test/earn.test.js`: O-1042 = 237P, 배송비 제외 기준(10,000원 → 100P)
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
