## 리뷰 지적
없음

(검토한 것: 변경은 `src/config.js`, `src/points/earn.js`, `test/order.test.js` 세 파일뿐이다. 원인(배송비 포함 total에 공용 1%·반올림 적용)을 고쳤고 증상만 가린 것이 아니다. `earnPoints`의 사용처는 `createOrder` 하나이고, 선물·환불은 `POINT_RATE_PERCENT`와 `percentOf`를 그대로 쓴다. 정수 입력이라 `Math.floor(x*2/100)`에 부동소수점 문제는 없다.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1107 주문을 만들면 `points.earned`가 486이다) | 통과 | `node src/cli.js examples/O-1107.json \| grep 적립` → `적립 예정 486P` (fix.md의 수정 전 273P와 비교). 재현 테스트 'O-1107…'도 통과 |
| `npm test`가 통과한다 | 통과 | `npm test` → 21 pass / 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 삭제된 테스트 없음. 기존 테스트 1건의 기대값만 500→1000으로 바뀌었고 아래 '테스트 파일 변경' 참고 |
| 적립 포인트는 배송비를 제외한 (상품 금액 − 쿠폰 − 사용 포인트)의 2%를 1P 미만 버림해 계산한다 | 통과 | `src/points/earn.js:6` `Math.floor((goods - coupon - pointsUsed) * 2 / 100)`. O-1107: 24,330 × 2% = 486.6 → 486 |
| 이미 생성된 주문의 `points.earned`와 영수증 출력은 이전과 같다 | 통과 | 저장된 `points.earned`를 쓰는 구조(`order.js:35`, `receipt.js:16`)가 그대로이고 `git diff`에 저장·영수증 코드 변경 없음. `test/receipt.test.js`, `test/refund.test.js` 통과 |
| `src/format/` 아래 파일은 변경되지 않는다 | 통과 | `git diff 65a3a4f --stat -- src/format` 결과 비어 있음 |
| 선물하기 적립과 부분 환불 회수의 결과는 이전과 같다 | 통과 | `src/gift`, `src/orders/refund.js`, `src/money.js` 변경 없음(`git diff --stat` 비어 있음). `test/gift.test.js`, `test/refund.test.js` 통과 |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — ① '적립 포인트를 주문에 저장한다'는 단언 하나의 기대값만 500→1000으로 바꿨다. 입력 50,000원(배송비·쿠폰·포인트 없음)의 2%가 1000으로, 규정 변경(1%→2%)을 그대로 반영한 것이고 검사 강도는 같다. ② 'O-1107…' 테스트를 새로 추가했다(재현 테스트). 삭제된 테스트는 없다.

## 남은 위험
- 부분 환불 회수(`src/orders/refund.js:34`)는 1% 기준이라 2%로 적립된 새 주문을 부분 환불하면 회수 포인트가 적립보다 적게 나올 수 있다. 비목표라 이번에 바꾸지 않았다. 별도 Work 필요.
- 앞 Work(w-20261004-001, -002)에서 `earn.js`·`refund.js` 등을 고쳤을 수 있음, 머지 대기. 머지 시 `src/points/earn.js`에서 충돌 가능.
- `docs/knowledge/points-earn-rule.md`는 앞 Work(w-20261004-001) 파일을 2% 기준으로 고쳐 다시 썼다. 머지 시 충돌 가능.
