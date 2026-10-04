## 리뷰 지적
1. [권장] test/earn.test.js:59 — "저장된 points.earned는 다시 계산하지 않는다" 테스트는 부분 환불만 건드려 저장값이 실제로 쓰이는 `cancelOrder`를 확인하지 않는다. earned 999인 주문의 전체 취소 회수가 999인 테스트를 추가하자.
2. [사소] src/money.js:13 — `percentOf`가 이제 어디에서도 쓰이지 않는다. 다만 일반 금액 도우미라 남겨도 무방하다.

## 반영
- 1 — `cancelOrder`가 저장된 `points.earned`(999)를 그대로 회수한다는 테스트를 `test/earn.test.js`에 추가. 커밋 9cd5571. `npm test`: 28개 통과, 0개 실패. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1042 적립 예정 포인트가 237P) | 통과 | `node src/cli.js examples/O-1042.json` 마지막 줄 `적립 예정 237P` (수정 전 268P, fix.md의 재현 기록과 비교) |
| `npm test`가 통과한다 | 통과 | `npm test`: tests 28, pass 28, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 612e2ea --stat -- test`: 기존 테스트 파일 변경 없음, `test/earn.test.js`만 추가 |
| 배송비가 있는 주문과 없는 주문 모두, 적립 대상 금액에서 배송비가 빠진다는 테스트가 있다 | 통과 | `test/earn.test.js` "배송비는 적립 대상에서 빠진다" (배송비 3000 → 200P, 무료배송 → 300P), 통과 |
| 1P 미만이 버려진다(반올림하지 않는다)는 테스트가 있다 | 통과 | `test/earn.test.js` "1P 미만은 버리고…" (29990 → 299P), 통과 |
| 선물하기 적립과 환불 포인트 회수가 같은 규칙으로 계산된다는 테스트가 있다 | 통과 | `test/earn.test.js` "선물하기 적립도…"(237P), "환불 회수도…"(237−154), "나눠 환불해도…" 통과 |
| 이미 저장된 `points.earned` 값은 다시 계산되지 않고 그대로 쓰인다 | 통과 | `cancelOrder`는 `order.points.earned`를 그대로 반환(`src/orders/refund.js:44`, 변경 없음), 신규 테스트 earned 999 → 999 통과. `createOrder`/`createGiftOrder`만 계산해 저장 |
| `src/format/`의 파일과 영수증 출력의 글자 모양이 바뀌지 않는다 | 통과 | `git diff 612e2ea --stat -- src/format` 출력 없음. CLI 출력의 줄 차례와 칸 너비 동일(값만 237P) |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 신규 파일(8개 테스트 추가). 기존 테스트 변경·삭제 없음

## 남은 위험
- 옛 규칙으로 저장된 주문은 `points.earned`가 새 규칙보다 커서, 부분 환불 회수 합계가 earned보다 적을 수 있다.
- 부분 환불 회수가 호출자가 넘기는 `alreadyRefunded`에 의존한다.
- `percentOf`는 미사용으로 남음.
