## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json` (워크트리 루트)
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 적립 예정 268P

## 원인
- 원인: `earnPoints`가 배송비가 든 `amounts.total`(26,770)에 `percentOf`(반올림)를 적용해 268P가 나왔다. 선물 적립(`gift-points.js`)도 같은 식이고, 환불 회수(`refund.js`)는 환불 상품 금액에 반올림을 적용해 주문 적립과 기준이 달랐다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`. 배송비 3,000원이 없는 주문은 total과 기준 금액이 같아 차이가 반올림에서만 생긴다(총액이 30,000원 이상이면 배송비가 0이라 재현되지 않는다). 수정 뒤 O-1042는 (28,270−3,000−1,500)=23,770 → 237P. 코드를 고쳐 테스트가 실패에서 통과로 바뀌는 것으로 확인했다.
- 사람 추정 판정: 요청이 지목한 파일은 `src/points/earn.js` — 일부 맞음. earn.js가 원인이지만 같은 계산이 gift-points.js와 refund.js에도 있어 거기도 고쳐야 한다.
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — 버림 도우미 `floorPercentOf` 추가(기존 `percentOf`는 그대로).
- `src/points/earn.js` — `earnBase`(상품−쿠폰−사용 포인트), `pointsForBase`(1% 버림)를 두고 `earnPoints`가 저장된 `amounts`의 goods/coupon/pointsUsed로 계산한다.
- `src/gift/gift-points.js` — `earnPoints`를 그대로 쓴다.
- `src/orders/refund.js` — 부분 환불 회수 포인트 = (환불 전 기준 금액의 적립) − (환불 후 기준 금액의 적립). 쿠폰과 사용 포인트는 남은 주문에 두므로 기준에서 계속 뺀다. 나눠 환불해도 합이 전체 적립과 어긋나지 않는다.
- `test/earn.test.js` — 새 테스트(기존 테스트는 바꾸지 않음).

## 재현 테스트
- 위치: `test/earn.test.js` (O-1042 237P, 배송비 있음/없음, 쿠폰·사용 포인트, 버림, 선물, 부분 환불·나눠 환불, 배송비 있는 주문 환불)
- 수정 전: 실패 — `git stash`로 src 변경을 치우고 `node --test test/earn.test.js` → pass 2 / fail 5
- 수정 후: 통과 — `node --test test/earn.test.js` → 전부 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 27개 통과, 0개 실패 (수정 전 기준 커밋은 20개 통과)
- 실패 항목: 없음
