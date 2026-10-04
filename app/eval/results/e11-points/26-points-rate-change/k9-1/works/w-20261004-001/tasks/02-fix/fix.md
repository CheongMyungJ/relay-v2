## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P

## 원인
- 원인: `earnPoints`가 배송비가 포함된 `amounts.total`(26,770원)에 `percentOf`(반올림)를 적용했다. 배송비를 빼고 버림해야 한다(23,770원 → 237P).
- 근거: `src/points/earn.js:5` 수정 전 코드. `giftPoints`(`src/gift/gift-points.js`)도 같은 식을 따로 복사해 갖고 있었고, 부분 환불 회수(`src/orders/refund.js:34`)도 반올림이었다. 수정 전 4개 새 테스트가 실패하고 수정 후 통과했다(src만 되돌려 실험).
- 사람 추정 판정: 고객센터 안내 기준 237P — 맞음 — 배송비 제외 후 버림하면 23,770 × 1% = 237.7 → 237로 일치
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 버림 도우미 `percentFloor` 추가
- src/points/earn.js — (total − shipping)의 적립률%를 버림
- src/gift/gift-points.js — `earnPoints`를 그대로 쓰게 해 두 경로가 어긋나지 않게 함
- src/orders/refund.js — 부분 환불 포인트 회수도 버림으로 바꿔 적립 계산과 맞춤(반올림이면 적립보다 더 회수될 수 있음)
- test/order.test.js, test/gift.test.js, test/refund.test.js — 테스트 추가(기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/order.test.js(O-1042 237P, 배송비 유·무), test/gift.test.js, test/refund.test.js
- 수정 전: 실패 (src를 되돌리고 `npm test` → 4개 not ok, pass 20 / fail 4)
- 수정 후: 통과 (`npm test` → pass 24 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패. `node src/cli.js examples/O-1042.json` → 237P
- 실패 항목: 없음
