## 리뷰 지적
1. [권장] src/orders/refund.js:11 — `earnedOn`이 `earnPoints`와 중복이다. 앞 Work(w-20261004-001)가 머지돼야 합칠 수 있어 지금은 합치지 못한다. 머지 뒤 `earnPoints`로 바꾸자.
2. [사소] src/orders/refund.js:10 — 주석이 이 브랜치에 없던 `docs/knowledge/points/earn-rule.md`를 가리켰다. 이 단계에서 그 파일을 남겨 해소된다.
3. [사소] test/refund.test.js:44 — 두 번째 추가 테스트는 수정 전에도 통과한다. 회귀 방지용이라 유지해도 된다.

## 반영
없음 (사람이 반영하지 않음을 골랐다). 지식 파일 `docs/knowledge/points/earn-rule.md`만 커밋 01fbf3b로 남겼다. 코드는 바꾸지 않았다.

## 반영하지 않은 지적
- 1, 2, 3

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (R-0311 환불의 `pointsRecovered`가 132) | 통과 | `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 환불 금액 13,130원, 포인트 회수 -132P (수정 전 131P) |
| `npm test`가 통과한다 | 통과 | `npm test` → 22개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 99180b4 -- test/`: 기존 테스트 줄은 그대로이고 import 1줄과 테스트 2개만 추가됨 |
| 부분 환불 회수 포인트가 "환불 전 남은 주문의 적립 - 환불 후 남은 주문의 적립"과 같다는 테스트가 있다 | 통과 | `test/refund.test.js`의 O-1077/R-0311 테스트(132P)와 쿠폰·사용 포인트·기환불 테스트. 첫 테스트는 수정 전 131이라 실패했다 (fix.md 기록) |
| 같은 입력에서 `refundAmount`와 `src/format/`의 영수증 출력이 수정 전과 같다 | 통과 | `refundAmount: refundGoods` 줄과 `src/format/`은 변경 없음(diff는 refund.js와 테스트뿐). CLI 환불 금액 13,130원 동일, 테스트가 13130을 확인. 영수증의 회수 줄은 `pointsRecovered` 값(-132P)만 달라진다 |
| 이미 저장된 주문의 `points.earned`와 `alreadyRefunded` 처리 결과가 수정 전과 같다 | 통과 | `src/orders/order.js`·`src/points/earn.js` 변경 없음. `already`·`refundedBefore`·`remainingGoods` 계산 줄은 그대로. `alreadyRefunded` 테스트 통과 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 기존 테스트는 그대로 두고 import와 테스트 2개만 추가했다.

## 남은 위험
- `earnedOn`이 `earnPoints`와 중복이다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 뒤 합쳐야 한다.
- `src/gift/gift-points.js`와 `cancelOrder`는 범위 밖이라 그대로다.
- 두 번째 추가 테스트는 수정 전에도 통과해 회귀 방지 효과만 있다.
