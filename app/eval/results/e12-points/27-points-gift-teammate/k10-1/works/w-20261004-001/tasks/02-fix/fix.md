## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P (결제 금액 26,770원의 1%를 반올림)

## 원인
- 원인: `earnPoints`가 배송비와 포인트 사용 차감이 섞인 결제 금액(`amounts.total`)에 반올림 `percentOf`를 적용했다. 배송비 3,000원이 기준에 들어가고 포인트 사용 1,500원은 차감 전 기준이라 많게 나온다. (total은 포인트 차감 후지만 배송비를 포함한다.)
- 근거: `src/points/earn.js:5` 수정 전 코드, `src/money.js` `percentOf`는 `Math.round`. O-1042 실행 결과 268P. 수정 후 237P.
- 사람 추정 판정: 없음
- 기각한 가설: 선물하기 적립이 `earnPoints`를 공유한다 — `src/gift/gift-points.js`는 자체로 `percentOf`를 호출하고 `earnPoints`를 쓰지 않아 영향 없음(변경 없음 확인).

## 변경 요약
- `src/points/earn.js` — 기준을 `goods - coupon - pointsUsed`로, 계산을 버림으로 변경
- `src/money.js` — 버림 도우미 `floorPercentOf` 추가
- `test/order.test.js` — 재현 테스트 2개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: `test/order.test.js` 마지막 두 테스트 (O-1042 237P, 배송비 없는 주문 389P)
- 수정 전: 실패 (`npm test` → 22개 중 2개 실패, 수정 전 src로 확인)
- 수정 후: 통과 (`npm test` → 22 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 22 pass, 0 fail
- 실패 항목: 없음
