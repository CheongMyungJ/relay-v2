## 리뷰 지적
1. [사소] src/points/earn.js:6 — 내림 계산을 `money.js`의 도우미 없이 인라인 `Math.floor`로 썼다. 동작에는 문제 없다.
2. [사소] test/earn.test.js:15 — O-1107의 243P는 고객센터 확인 없이 같은 규칙으로 계산한 값인데 확정값처럼 고정했다.
3. [사소] test/earn.test.js — 저장된 주문(O-1077)의 `points.earned`를 그대로 쓴다는 것을 직접 확인하는 테스트가 없다 (`test/refund.test.js:31`이 일부 덮음).

## 반영
없음

## 반영하지 않은 지적
- 1, 2, 3 (사람이 "반영하지 않음"을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1042 적립 예정 포인트가 237P) | 통과 | `node src/cli.js examples/O-1042.json` → "적립 예정 237P" (수정 전 268P) |
| `npm test`가 통과한다 | 통과 | `npm test` → 23개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff e90e5a6 --stat`: 기존 테스트 파일 변경 없음, `test/earn.test.js`만 새로 추가 |
| 적립 계산 오류를 잡는 테스트가 추가되어 O-1042에서 237P를 확인한다 | 통과 | `test/earn.test.js` 첫 테스트가 O-1042에서 237 확인. fix.md에 따르면 수정 전에는 실패한다 |
| `src/format/`과 `src/gift/gift-points.js`는 변경되지 않는다 | 통과 | `git diff e90e5a6 --stat -- src/format src/gift` 결과 없음. 바뀐 코드는 `src/points/earn.js`뿐 |
| 이미 저장된 주문의 `points.earned` 값은 다시 계산되지 않고 그대로 쓰인다 | 통과 | 계산은 `createOrder`(`order.js:35`)에서만 일어난다. 환불은 저장된 값을 쓴다(`refund.js:42`). `node src/cli.js examples/R-0311.json --order examples/O-1077.json`이 정상 동작한다. 단 `createOrder`에 O-1077을 넣으면 새로 계산해 423이 나오는데, 이는 저장 주문이 아니라 새 주문 생성 경로다 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새로 추가한 파일이다. 기존 테스트는 바뀌거나 지워지지 않았다.

## 남은 위험
- 배송비 제외·내림 기준은 O-1042 한 건의 고객센터 값에서 추론했다. O-1107의 243P도 확인되지 않았다.
- 선물하기 적립(`src/gift/gift-points.js`)은 총액 반올림 그대로라 일반 주문과 기준이 다르다 (비목표).
- 부분 환불 회수 포인트(`src/orders/refund.js:34`)는 상품 금액 1% 반올림이라 적립 규칙과 어긋날 수 있다.
