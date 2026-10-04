## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json` 의 마지막 줄 확인
- 결과: 재현됨
- 기대: 적립 예정 237P (28270 − 3000 − 1500 = 23770의 1%, 버림)
- 실제: 268P

## 원인
- 원인: `earnPoints`/`giftPoints`가 배송비가 들어간 결제 금액(`amounts.total`)에 `percentOf`(반올림)를 써서 배송비만큼 적립이 많아지고 반올림까지 된다. 환불 회수(`refund.js`)도 `percentOf(refundGoods)`로 반올림하고 쿠폰·사용 포인트를 적립 대상에서 빼지 않았다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(수정 전). O-1042의 total 26770 → 1% 반올림 = 268로 실제 출력과 일치. 수정 뒤 237P 출력. 배송비 없는 주문은 total과 적립 대상이 같아 어긋나지 않는 조건도 설명된다(쿠폰·포인트 사용이 없고 무료배송이면 같음).
- 사람 추정 판정: 없음 (직전 handoff의 "amounts.total 기준 반올림" 가설은 맞음으로 확인)
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — 버림 방식 `floorPercentOf` 추가(`percentOf`는 그대로)
- `src/points/earn.js` — `earnBase`(상품 − 쿠폰 − 사용 포인트), `pointsOf`(1% 버림) 추가, `earnPoints`가 이를 쓴다
- `src/gift/gift-points.js` — `earnPoints`와 같은 규칙을 쓰게 함
- `src/orders/refund.js` — 부분 환불 회수 = 환불 전 적립 포인트 − 환불 후 적립 포인트(남은 주문에 쿠폰·사용 포인트는 그대로). 이전 환불 분(`alreadyRefunded`)을 반영하므로 나눠 환불해도 합계가 적립을 넘지 않는다. `cancelOrder`는 저장된 `points.earned` 그대로(변경 없음)
- 기존 테스트 변경 없음. `src/format/` 변경 없음, 저장된 `points.earned`는 다시 계산하지 않음.

## 재현 테스트
- 위치: `test/earn.test.js` (신규 7개)
- 수정 전: 실패 (`src`를 되돌리고 `npm test`: 6개 실패, pass 21 / fail 6)
- 수정 후: 통과 (`npm test`: pass 27 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 27개 통과, 0개 실패
- 실패 항목: 없음
