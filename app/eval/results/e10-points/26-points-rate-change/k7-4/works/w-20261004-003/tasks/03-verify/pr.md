# fix: 적립률 2%, 배송비 제외 기준액 버림 적립, 선물하기 적립률 분리

## 요약
기본 적립률을 1%에서 2%로 올리고, 적립 기준액을 배송비 제외 금액으로, 소수점은 버림으로 바로잡았다. O-1107은 486P로 적립된다. 선물하기 적립률은 별도 상수로 1%를 유지한다.

## 원인
`earnPoints`가 배송비 포함 `amounts.total`에 반올림을 적용했다(O-1107은 2%에서 547P). 선물하기가 같은 상수를 공유해 상수만 올리면 함께 바뀌는 구조였다.

## 변경
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `GIFT_POINT_RATE_PERCENT = 1` 추가
- `src/money.js`: `percentOfFloor` 추가
- `src/points/earn.js`: (total − shipping)에 버림 적용
- - `src/gift/gift-points.js`: 별도 상수 사용(동작 불변)
- 저장된 `points.earned`와 `src/format/`은 그대로
- `docs/knowledge/`에 적립률·선물하기 분리 지식 추가
- 환불 계산 로직(`refund.js`)은 바꾸지 않았다. 환불 회수 계산은 정산팀과 따로 정한다. 단 회수가 `POINT_RATE_PERCENT`를 읽어 2%가 적용된다

## 테스트
- `npm test`: 22 통과 / 0 실패
- `node src/cli.js examples/O-1107.json` → 적립 예정 486P
- 추가: O-1107 적립, 선물하기 1% 유지. 기존 기대값 3곳은 2%에 맞춰 수정
