## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 부분 환불 회수가 `percentOf(refundGoods, POINT_RATE_PERCENT)`(반올림)라 새 적립(내림)과 1P 어긋날 수 있다. 이번 변경 밖의 코드이고 intent 목표에 환불이 없다. 환불 회수를 내림으로 맞추는 것을 제안한다.
2. [사소] test/order.test.js — 재현 테스트가 O-1042 한 건뿐이라 쿠폰·포인트가 없는 주문의 내림 경계는 따로 검증하지 않는다.

## 반영
없음 (사람이 반영하지 않음을 고름)

## 반영하지 않은 지적
- 1, 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1042 적립 예정 포인트가 237P) | 통과 | `node src/cli.js examples/O-1042.json \| grep 적립` → `적립 예정 237P` (수정 전 268P) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 21, pass 21, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff a3cc42a -- test`에 삭제·수정된 줄이 없고 테스트 1개만 추가됨 |
| 이미 적립된 포인트가 있는 주문은 저장된 값을 그대로 쓰고 다시 계산하지 않는다 | 통과 | 적립 계산은 `createOrder`(src/orders/order.js:35)에서만 일어나고 환불 전체 취소는 `order.points.earned`를 그대로 쓴다(refund.js:42). 이번 변경은 `earnPoints`만 바꿨다. 저장된 주문(O-1077, earned 403)으로 `R-0311 --order` 환불을 실행해도 오류 없이 동작한다. 다만 `examples/O-1077.json`을 주문 입력으로 넣으면 `createOrder`가 새로 계산(423P)하는데, 이는 수정 전부터의 동작이다 |
| `src/gift/gift-points.js`와 `src/format/` 아래 파일은 변경되지 않는다 | 통과 | `git diff a3cc42a --name-only`에 `src/gift/`, `src/format/` 없음. 변경 파일은 src/points/earn.js, test/order.test.js 둘뿐 |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — 재현 테스트 1개만 추가했고 기존 줄은 그대로다. 내림 전 값 237.7, 반올림이면 238이라 수정을 실제로 잡는다.

## 남은 위험
- 고객센터 규칙(배송비 제외, 포인트 차감, 내림)은 O-1042 한 건에서 역산했다. 다른 주문의 정답은 확인하지 않았다. O-1077은 423P(전과 같음), O-1107은 243P(전 273P)가 나온다.
- 부분 환불 회수(src/orders/refund.js:34)가 반올림이라 적립과 1P 어긋날 수 있다.
- 선물하기 적립(src/gift/gift-points.js)에는 같은 버그 식이 남아 있다. 다른 팀과 같이 보는 중이라 범위에서 뺐다.
