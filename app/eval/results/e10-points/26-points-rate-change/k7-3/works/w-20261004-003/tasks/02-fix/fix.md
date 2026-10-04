## 재현
- 재현 절차: `examples/O-1107.json`을 `createOrder`에 넣고 `points.earned`를 본다 (`node --input-type=module -e "import {createOrder} from './src/orders/order.js'; import fs from 'fs'; console.log(createOrder(JSON.parse(fs.readFileSync('examples/O-1107.json'))).points.earned)"`)
- 결과: 재현됨
- 기대: 486P ((27,350 - 2,000 - 1,020) × 2% = 486.6 → 486, 배송비 제외, 버림)
- 실제: 273P (적립률 1%, 총 결제 27,330원 기준 반올림)

## 원인
- 원인: 적립률 `POINT_RATE_PERCENT`가 1이고, `earnPoints`가 배송비를 포함한 `amounts.total`에 반올림(`percentOf`)을 쓴다. 팀 지식 기준은 (total - shipping), 버림이다.
- 근거: `src/config.js:9`, `src/points/earn.js:6`, `src/money.js` `percentOf`=`Math.round`. 수정 전 재현 테스트 실제값 273. 율만 2%로 바꾸면 27,330×2% = 546.6 → 547P(intake 메모)로 486과 다르다. 상수 `POINT_RATE_PERCENT`는 `gift-points.js`와 `refund.js`도 쓰므로 그대로 바꾸면 선물하기·환불 회수까지 2%가 된다.
- 사람 추정 판정: 이 브랜치의 earn.js가 배송비 포함·반올림이라 율만 바꾸면 547P — 맞음 — 코드와 계산으로 확인
- 기각한 가설: 없음

## 변경 요약
- src/config.js — `POINT_RATE_PERCENT`를 2로, 기존 1%는 `LEGACY_POINT_RATE_PERCENT`로 추가
- src/points/earn.js — (total - shipping) × 율 / 100, 버림
- src/gift/gift-points.js, src/orders/refund.js — `LEGACY_POINT_RATE_PERCENT`(1%) 사용으로 바꿔 동작 유지 (선물하기는 비목표, 환불 회수식은 저장 주문 결과가 바뀌지 않게)
- (기존 테스트 변경) test/order.test.js '적립 포인트를 주문에 저장한다' — 기대값 500 → 1000 (50,000원, 배송비 0, 2%)

## 재현 테스트
- 위치: test/order.test.js 'O-1107의 적립은 486P'
- 수정 전: 실패 (`node --test test/order.test.js` — expected 486, actual 273)
- 수정 후: 통과 (`npm test`)

## 테스트 실행
- 명령: npm test
- 결과: 21 pass, 0 fail
- 실패 항목: 없음
