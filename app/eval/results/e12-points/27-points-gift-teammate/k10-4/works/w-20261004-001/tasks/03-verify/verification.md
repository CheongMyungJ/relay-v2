## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1042의 적립 예정 포인트가 237P) | 통과 | `node src/cli.js examples/O-1042.json \| grep 적립` → `적립 예정 237P` (수정 전 268P) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 24, pass 24, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f0525d5`에서 기존 테스트 변경·삭제 없음. `test/earn.test.js`만 신규 |
| 배송비가 붙는 주문과 무료인 주문 모두 적립 기준 금액에 배송비가 들어가지 않는다 | 통과 | `src/points/earn.js`는 goods − coupon − pointsUsed만 사용. 배송비 3,000원 O-1042 → 237P, 배송비 무료 테스트(370P), 배송비 제외 테스트(100P) 통과 |
| 적립 포인트의 소수점은 버린다 (예: 23,770원 → 237P) | 통과 | `Math.floor` 사용. 23,770원 → 237P 테스트 통과 |
| 이미 저장된 `points.earned` 값은 다시 계산하지 않고 그대로 쓴다 | 통과 | `earnPoints`는 `createOrder`(`src/orders/order.js:35`)에서만 호출. `receipt.js:16`, `refund.js:42`는 저장된 `order.points.earned`를 읽음 |
| `src/format/`과 `src/gift/gift-points.js`는 바뀌지 않는다 | 통과 | `git diff f0525d5 --stat -- src/format src/gift` 출력 없음 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 신규 파일(테스트 4개 추가). 기존 테스트는 바뀌지 않았다

## 남은 위험
- 부분 환불의 회수 포인트(`src/orders/refund.js:34`)는 `percentOf` 반올림이라 새 적립 규칙(소수점 버림)과 1P 어긋날 수 있다.
- 선물하기 적립(`src/gift/gift-points.js`)은 배송비 포함 total 기준 반올림 그대로다. 다른 팀과 논의 중이다.
