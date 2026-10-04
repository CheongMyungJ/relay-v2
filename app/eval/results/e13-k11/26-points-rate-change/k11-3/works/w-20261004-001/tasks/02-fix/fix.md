## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json | tail -1`, `node src/cli.js examples/G-0213.json | tail -1`
- 결과: 재현됨
- 기대: O-1042 적립 예정 237P (25,270 − 1,500 = 23,770 × 1% 버림)
- 실제: 268P (결제 금액 26,770원의 1%, 배송비 포함). G-0213은 249P (기대 218P)

## 원인
- 원인: 적립과 선물하기 적립이 배송비가 들어간 `amounts.total`에 `percentOf`(반올림)를 적용했고, 환불 회수도 `percentOf`(반올림)를 썼다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(수정 전), `src/money.js:13`의 `Math.round`. 수정 후 CLI가 237P/218P를 낸다. 배송비가 없고 소수점도 없는 주문(기존 테스트 500P, 300P)은 옛 계산과 같아 기존 테스트가 통과했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — 버림 도우미 `floorPercentOf` 추가 (`percentOf`는 그대로 둠)
- `src/points/earn.js` — (goods − coupon − pointsUsed)의 비율을 버림으로 계산
- `src/gift/gift-points.js` — `earnPoints`에 위임해 같은 규칙을 쓰게 함
- `src/orders/refund.js` — 회수 포인트를 `floorPercentOf`로 계산
- 기존 테스트 변경 없음. 저장된 `points.earned`를 쓰는 `cancelOrder`, `src/format/`, ledger는 건드리지 않음.

## 재현 테스트
- 위치: `test/order.test.js`(O-1042 237P, 배송비 없는 주문 버림), `test/gift.test.js`(G-0213 218P), `test/refund.test.js`(회수 39P)
- 수정 전: 실패 (`npm test` → 4건 실패: 선물하기, 주문 2건, 부분 환불)
- 수정 후: 통과 (`npm test` → 24건 통과, 실패 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24 통과, 0 실패
- 실패 항목: 없음
