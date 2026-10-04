## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json` (작업 디렉터리: 워크트리 루트)
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 수정 전 268P (결제 금액 26,770원의 1%를 반올림)

## 원인
- 원인: 적립 포인트를 배송비가 포함된 결제 금액(`amounts.total`)에 반올림(`Math.round`)으로 계산했다. 기준 237P는 배송비를 뺀 금액(상품-쿠폰-사용 포인트 = 23,770원)의 1%를 소수점 버림한 값이다.
- 근거: `src/points/earn.js:6` 수정 전 `percentOf(order.amounts.total, 1)`. O-1042는 26,770 → 268, 배송비 제외 23,770 → 237.7. 반올림이면 238이라 237이 되려면 버림도 필요하다. 사용 포인트를 빼지 않으면 252라 맞지 않는다. 배송비 무료인 O-1077은 수정 전후 모두 저장값 403P와 같아, 배송비가 있는 주문에서만 어긋나는 현상도 설명된다. 수정 전 코드를 되돌려 테스트가 실패함을 확인했다.
- 사람 추정 판정: `src/points/earn.js`에 문제가 있을 것이다 — 맞음. 적립 계산이 이 파일에 있고 여기를 고쳤다. 같은 계산이 `src/gift/gift-points.js`, `src/orders/refund.js`에도 있었다.
- 기각한 가설: 사용 포인트 미차감이 원인 — 차감하지 않으면 252P라 237P와 맞지 않는다. 반올림만 바꾸면 해결 — 26,770의 버림은 267P라 맞지 않는다.

## 변경 요약
- `src/money.js` — 소수점 버림 `floorPercentOf` 추가.
- `src/points/earn.js` — 적립 대상 금액을 `total - shipping`으로, 버림 계산으로 변경.
- `src/gift/gift-points.js` — 같은 계산의 복사본을 `earnPoints`로 위임 (사람 결정: 함께 고침).
- `src/orders/refund.js` — 부분 환불의 `pointsRecovered`를 버림으로 변경 (사람 결정). 기존 테스트 값(100P)은 그대로 통과.
- `test/earn.test.js` — 새 테스트.
- `src/format/`과 저장된 `points.earned`는 건드리지 않았다.

## 재현 테스트
- 위치: `test/earn.test.js` (O-1042 237P, O-1107 243P, O-1077 저장값 일치, 버림, 선물 G-0213 218P, 환불 회수 34P)
- 수정 전: 실패 (`git stash push -- src` 뒤 `npm test`: pass 21 / fail 5. O-1042, O-1107, 버림, 선물, 환불 회수 실패. O-1077은 배송비가 없어 통과)
- 수정 후: 통과 (`npm test`: pass 26 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 26개 통과, 0개 실패
- 실패 항목: 없음
