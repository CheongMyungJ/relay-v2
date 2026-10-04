# fix: 적립 포인트 기준에서 배송비를 빼고 1P 미만은 버린다

## 요약
적립 예정 포인트가 고객센터 계산보다 많게 나오던 문제를 고쳤다. O-1042는 268P에서 237P가 된다.

## 원인
`earnPoints`가 배송비가 든 `amounts.total`을 기준으로 쓰고 `percentOf`로 반올림했다. 고객센터는 배송비를 뺀 금액(상품 − 쿠폰 − 사용 포인트)의 1%를 1P 미만 버림으로 계산한다.

## 변경
- `src/points/earn.js`: 기준을 `total − shipping`으로 바꾸고 버림. 공용 `percentOf`는 그대로 둠
- `test/order.test.js`: 회귀 테스트 2개 추가(O-1042 → 237P, O-1107 → 243P)
- `docs/knowledge/points/earn-basis.md`: 적립 기준 규칙과 선물하기 적용 여부 미정 사항 기록
- 비목표: 저장된 `points.earned` 재계산, `src/format/`, `src/gift/gift-points.js`는 변경 없음

## 테스트
- `npm test`: 22개 통과
- O-1042 237P, O-1077 423P(변화 없음), O-1107 243P 직접 확인
