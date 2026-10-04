## 리뷰 지적
1. [사소] test/earn.test.js — 저장된 `points.earned`가 재계산되지 않는다는 것을 확인하는 테스트가 없다. `cancelOrder`가 저장값을 쓰는 테스트 추가를 제안한다. (재계산하는 코드는 없어서 동작 문제는 아니다)

그 밖에 확인한 것: 변경은 목표·비목표에 맞고, 원인(율 상수, 배송비 포함 반올림, refund.js의 상수 공유)을 직접 고쳤다. 증상만 가린 곳은 없다. 포인트 사용은 상품-쿠폰 한도라 `total - shipping`이 음수가 되지 않는다. `floorPercentOf`는 `earn.js`와 `gift-points.js`가 쓰므로 미사용 코드가 아니다.

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`examples/O-1107.json`으로 주문을 만들면 `points.earned`가 486이다) | 통과 | fix.md의 재현 명령을 다시 실행: `points: { used: 1020, earned: 486 }` (수정 전 273) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 23, pass 23, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 삭제된 테스트 없음. 기대값을 바꾼 기존 테스트 2개는 2% 적용에 따른 것이고 검사 강도는 같다 (아래 참고) |
| 적립률 2%가 적용된 새 주문의 적립 계산에 대한 테스트가 있다 (O-1107 → 486P 포함) | 통과 | `test/earn.test.js`: O-1107 → 486, 버림(156), 선물 적립. `node --test`에 포함되어 통과 |
| 이미 적립된 주문의 `points.earned`는 다시 계산되지 않고 저장된 값 그대로다 | 통과 | `grep`으로 확인: `earnPoints`/`giftPoints`는 `createOrder`/`createGiftOrder`에서만 호출. `cancelOrder`는 `order.points.earned`를 그대로 쓴다 (`src/orders/refund.js:42`). 단, 이를 직접 검증하는 테스트는 없다 (지적 1) |
| 부분 환불 회수(`pointsRecovered`)의 계산 결과는 이번 변경 전과 같다 (새 비율이 적용되지 않는다) | 통과 | `refund.js`는 `REFUND_RECOVER_RATE_PERCENT = 1`과 `percentOf`(반올림)를 그대로 쓴다. `test/refund.test.js`(기존, 미변경)와 `test/earn.test.js`의 회수 가드(10,050원 → 101) 통과 |
| `src/format/` 파일이 변경되지 않는다 | 통과 | `git diff c7beaa7 --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새 파일. O-1107 486P, 버림, 선물 적립, 환불 회수 1% 유지를 검사한다
- test/order.test.js — 약화 아님 — 25,000원×2 주문의 적립 기대값 500 → 1000. 적립률 2%를 반영한 것이고 같은 값을 정확히 비교한다
- test/gift.test.js — 약화 아님 — 30,000원 선물 적립 기대값 300 → 600. 같은 이유이고 배송비 0이라 버림 영향이 없다

## 남은 위험
- 앞 Work(w-20261004-001, 002)의 배송비 제외·버림·환불 회수 변경이 머지 대기 중이다. 머지 시 `earn.js`, `gift-points.js`, `refund.js`, `config.js`에서 충돌할 수 있다
- 환불 회수 비율은 정산팀 결정 전까지 1% 반올림이다. 적립 2%와 회수 1%가 어긋나 환불 시 회수가 적립보다 적게 나올 수 있다
- 저장된 적립을 재계산하지 않는다는 것을 지키는 테스트가 없다
