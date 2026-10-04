## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 부분 환불 회수 포인트(`pointsRecovered`)가 상품 금액을 `percentOf`로 반올림해, 새 적립 규칙(배송비 제외·버림)과 어긋날 수 있다. 다만 환불 결과가 바뀌므로 비목표와 충돌 소지가 있어 별도 Work를 제안한다.
2. [사소] test/order.test.js — 버림 경계(소수 .5 이상)와 배송비 0원 케이스를 따로 확인하는 테스트가 없다.

## 반영
- 2 — 테스트 `적립 포인트는 원 단위 버림이다 (배송비 0원, 350.5P)` 추가(35,050원 → 350P, 반올림이면 351). 커밋은 이 task의 마지막 커밋. `npm test` 22개 통과, 0 실패. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 1 (사람이 "환불은 건드리지 말고 별도로 남겨 달라"고 함. `docs/knowledge/points/earn-points-rule.md`에 기록)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 나타나지 않고 237P가 된다 | 통과 | `node src/cli.js examples/O-1042.json` → 적립 예정 237P (수정 전 268P는 fix.md 기록) |
| `npm test`가 통과한다 | 통과 | `npm test` → pass 22, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 4bafdac`에서 기존 테스트 변경·삭제 없음, 테스트 추가만 |
| `createOrder`로 만든 O-1042 입력의 `points.earned`가 237이다 | 통과 | test/order.test.js의 O-1042 테스트 통과 |
| 저장된 `points.earned`를 읽는 코드(영수증, 환불, 포인트 내역)의 결과가 바뀌지 않는다 | 통과 | `receipt.js`, `cancelOrder`는 저장값을 읽기만 하고 diff 없음. O-1077 423P 그대로. 부분 환불은 저장값이 아닌 `percentOf` 사용, 코드 불변 |
| `src/format/`과 `src/gift/gift-points.js`는 수정되지 않는다 | 통과 | `git diff 4bafdac --name-only`에 두 경로 없음 |
| 일반 주문의 적립 계산을 확인하는 테스트가 추가된다 | 통과 | test/order.test.js에 2개 추가(O-1042, 버림 경계) |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — 테스트 2개를 끝에 추가했을 뿐 기존 테스트와 단언은 그대로다.

## 남은 위험
- 버림 규칙은 O-1042 한 건과 합성 경계 케이스로만 확인했다. 적립 안내 원문으로 확인하지 못했다.
- 부분 환불 회수 포인트(`src/orders/refund.js:34`)는 여전히 상품 금액 반올림이라 적립액과 어긋날 수 있다.
- 선물하기 적립(`src/gift/gift-points.js`)은 배송비 포함 반올림 그대로다(범위 제외).
