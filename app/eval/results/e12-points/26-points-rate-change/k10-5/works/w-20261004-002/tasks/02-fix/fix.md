## 재현
- 재현 절차: `node -e "import('./src/orders/refund.js').then(async m=>{const fs=await import('fs');console.log(m.createRefund(JSON.parse(fs.readFileSync('examples/O-1077.json')),JSON.parse(fs.readFileSync('examples/R-0311.json'))))})"`
- 결과: 재현됨
- 기대: `pointsRecovered` 132 (403 − floor(27,180 × 1%) = 403 − 271)
- 실제: `pointsRecovered` 131, `refundAmount` 13130

## 원인
- 원인: `createRefund`가 회수 포인트를 환불 상품 금액(13,130원)의 1%를 반올림(`percentOf`)해 구했다. 저장된 `points.earned`와 남은 상품으로 다시 계산한 적립의 차이가 아니라서, 쿠폰·사용 포인트가 낀 주문에서 반올림 때문에 1~2P씩 어긋난다.
- 근거: `src/orders/refund.js:34` 수정 전 코드, 재현 출력 131. 13,130 × 1% = 131.3 → 131. 수정 후 같은 입력에서 132, 수정 전 코드로 되돌리면 새 테스트 2개 실패(실험함).
- 사람 추정 판정: 없음 (추가 의견은 기대값 132P 하나이고 수정 후 일치)
- 기각한 가설: 비율 안분 후 버림(팀 지식 earn-basis.md) — 사람이 기준이 아니라고 했고 같은 예에서 약 111P로 정산팀 132P와 맞지 않음

## 변경 요약
- src/money.js — 버림 함수 `floorPercentOf` 추가 (`percentOf`는 다른 호출처가 있어 그대로 둠)
- src/orders/refund.js — `pointsRecovered`를 `order.points.earned − floorPercentOf(remainingGoods − coupon − pointsUsed, POINT_RATE_PERCENT)`로 변경. `refundAmount`와 `cancelOrder`는 그대로
- test/refund.test.js — 테스트 2개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/refund.test.js 마지막 두 테스트 (R-0311 132P, alreadyRefunded 포함 케이스)
- 수정 전: 실패 (`src` 변경을 잠시 빼고 `npm test`: pass 20, fail 2, not ok 21·22)
- 수정 후: 통과 (`npm test`: pass 22, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 22개 통과, 0개 실패
- 실패 항목: 없음 (기준 커밋에서도 20개 모두 통과). `refundAmount`는 코드 변경이 없고 테스트(13130, 6565)로 확인. 영수증(`src/format/`)은 건드리지 않음
