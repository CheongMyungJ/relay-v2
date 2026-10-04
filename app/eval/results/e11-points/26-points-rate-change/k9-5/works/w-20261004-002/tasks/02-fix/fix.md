## 재현
- 재현 절차: `npm test` (추가한 테스트 `부분 환불 회수 포인트는 ... (O-1077/R-0311)`). 입력은 `examples/O-1077.json`, `examples/R-0311.json`을 테스트에 옮긴 것.
- 결과: 재현됨
- 기대: `pointsRecovered` 132 (403 − 271)
- 실제: 131

## 원인
- 원인: `createRefund`가 환불 상품금액(13,130원)의 1%를 반올림(`percentOf`, `Math.round`)해 회수한다. 팀 규칙은 환불 전·후 기준액 각각을 버림 적립한 값의 차이인데, 쿠폰·사용 포인트가 반영되지 않고 반올림·버림도 달라 1~2P 어긋난다.
- 근거: `src/orders/refund.js:34` (수정 전), `src/money.js:14` `Math.round`. 13,130×1% = 131.3 → 131, 규칙대로는 403 − 271 = 132. 수정 후 테스트 통과. 원인 코드를 규칙식으로 바꾸자 사라지므로 실험으로 확인함.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/money.js` — 원 단위 버림 `floorPercentOf` 추가 (기준 브랜치에 없어 직접 만듦)
- `src/orders/refund.js` — 회수 포인트를 `floor(환불 전 기준액×율) − floor(환불 후 기준액×율)`로 계산. `refundAmount`는 그대로.
- `test/refund.test.js` — 테스트 2개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: `test/refund.test.js` (O-1077/R-0311, alreadyRefunded 포함 케이스)
- 수정 전: 실패 (`npm test` → expected 132, actual 131)
- 수정 후: 통과 (`npm test` → pass 22, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패
- 실패 항목: 없음
