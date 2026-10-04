## 재현
- 재현 절차: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: 포인트 회수 132P (403 − 271)
- 실제: 131P (`pointsRecovered` 131)

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액의 적립률%를 반올림한 값(`percentOf(refundGoods, 1%)`)으로 계산했다. 저장된 적립과 남은 상품의 재계산 적립의 차이가 아니라서 정산팀 기준과 1~2P씩 어긋난다.
- 근거: `src/orders/refund.js:34` (수정 전), `src/money.js`의 `percentOf`는 `Math.round`. R-0311은 13,130 × 1% = 131.3 → 131이지만 정산 기준은 403 − floor(27,180 × 1%) = 132. 수정 후 같은 명령이 132P를 낸다.
- 사람 추정 판정: 요청에서 지목한 위치는 `src/orders/refund.js` — 맞음 — 회수식이 그 파일 34행에 있었다.
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 버림 도우미 `floorPercentOf` 추가(기존 `percentOf`는 다른 곳에서 쓰므로 그대로 둠).
- src/orders/refund.js — 회수 = 회수 전 적립 − 남은 상품((남은 상품 − 쿠폰 − 사용 포인트)의 적립률% 버림). 첫 환불의 회수 전 적립은 저장된 `points.earned`, `alreadyRefunded`가 있으면 그때 남은 상품으로 계산한 적립이다. 그래서 여러 번 부분 환불한 회수 합이 `earned − 최종 적립`이 되어 저장된 적립을 넘지 않는다. 환불 금액, `cancelOrder`, `src/format/`은 그대로.

## 재현 테스트
- 위치: test/refund.test.js (R-0311 132P, 두 번 부분 환불 합)
- 수정 전: 실패 (`npm test` → `not ok 21 - ... R-0311은 132P`, 131 반환)
- 수정 후: 통과 (`npm test` → 22개 모두 통과)
- 참고: 두 번 환불 테스트는 수정 전에도 통과했다(반올림 값이 우연히 맞음). 회수 합 상한을 지키는지 확인하는 용도다.

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패
- 실패 항목: 없음 (기존 20개 테스트는 변경 없이 통과)
