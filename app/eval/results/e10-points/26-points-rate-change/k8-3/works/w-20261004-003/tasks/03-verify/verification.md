## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1107을 `createOrder`로 만들면 `points.earned`가 486) | 통과 | `examples/O-1107.json`을 `createOrder`로 만들어 출력: `points.earned` 486 (goods 27350, coupon 2000, pointsUsed 1020, shipping 3000) |
| `npm test`가 통과한다 | 통과 | `npm test`: 22 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 바뀐 테스트 2개 파일은 기대값만 2% 기준으로 올렸고(500→1000, 300→600) 단언 수는 그대로. 삭제 없음, 새 테스트만 추가 |
| 적립 기준 금액은 상품 − 쿠폰 − 사용 포인트이고 배송비는 포함되지 않는다 | 통과 | `src/points/earn.js:6-7`이 `goods - coupon - pointsUsed` 사용. 배송비 3000원인 O-1107이 486 (포함하면 546) |
| 적립 포인트는 원 단위 버림이고 반올림하지 않는다 | 통과 | `floorPercentOf`(Math.floor) 사용. 24,330 × 2% = 486.6 → 486 |
| 선물하기 적립도 일반 주문과 같은 기준·비율·버림을 쓴다 | 통과 | `giftPoints`가 `earnPoints`를 호출. `test/gift.test.js`의 O-1107 동일 조건 테스트 486 통과 |
| 부분 환불과 전체 취소의 회수 포인트 동작이 변경 전과 같다 | 통과 | `git diff`상 `refund.js`는 상수만 `POINT_RECOVER_RATE_PERCENT`(=1)로 교체, `percentOf` 반올림 유지. 전체 취소(`order.points.earned` 반환)는 변경 없음. 환불 테스트 변경 없이 통과 |
| `src/format/`의 출력은 바뀌지 않는다 | 통과 | `git diff 51438bd -- src/format test/receipt.test.js`가 비어 있음. 영수증 테스트 통과 |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — 기존 기대값 500→1000(50,000원 × 2%)으로 올렸고 O-1107 테스트를 추가했다. 검증 강도는 같다
- test/gift.test.js — 약화 아님 — 기존 기대값 300→600(30,000원 × 2%)으로 올렸고 배송비·쿠폰·포인트 사용 케이스 테스트를 추가했다

## 남은 위험
- 정산팀이 회수 비율을 정하면 `POINT_RECOVER_RATE_PERCENT`를 바꿔야 한다
- 앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기. `refund.js`와 `earn.js`에서 충돌할 수 있다
- 이미 저장된 주문의 `points.earned`는 옛 계산 그대로다 (비목표)
