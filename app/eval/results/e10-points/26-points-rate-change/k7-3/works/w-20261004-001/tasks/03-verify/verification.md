## 리뷰 지적
1. [사소] test/earn.test.js — 저장된 `points.earned`를 다시 계산하지 않고 쓴다는 것을 확인하는 테스트가 새 테스트에 없다(기존 `test/receipt.test.js`가 저장값 290을 쓰긴 한다). 제안: 저장된 주문으로 영수증을 만드는 테스트 추가.

그 밖에 변경은 intent의 목표·비목표에 맞고, `fix.md`의 원인(배송비 포함 금액에 반올림)을 직접 고쳤으며 `percentOf`는 환불이 쓰므로 건드리지 않았다. 불필요한 변경은 없다.

## 반영
- 지적 1은 반영하지 않음(사람 결정).
- 사람 추가 요청(리뷰 지적 아님): 부분 환불 회수를 적립 기준에 맞춤. `src/orders/refund.js`가 `Math.min(Math.floor(환불 상품 금액 × 1% ), order.points.earned)`를 쓴다(커밋 1e48f3b). `percentOf`·`cancelOrder`·저장된 적립값은 그대로. `test/refund.test.js`에 O-1042 부분 환불(10,470원→104P), 나눠 환불 합계(178+34 ≤ 237), 적립값 상한, 전체 취소 237P 테스트 4개 추가. `npm test` → pass 29, fail 0. 재현 절차 변경 없음(`node src/cli.js examples/O-1042.json` → 237P).

## 반영하지 않은 지적
- 1

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`examples/O-1042.json`의 적립 예정 포인트가 237P) | 통과 | `node src/cli.js examples/O-1042.json` 마지막 줄 `적립 예정 237P` (fix.md의 수정 전 값은 268P) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 25, pass 25, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff b8bc0af --stat`: 바뀐 파일은 `src/points/earn.js`와 새 파일 `test/earn.test.js`뿐. 기존 테스트 파일 변경 없음 |
| 이미 만들어진 주문의 저장된 `points.earned`를 다시 계산하지 않고 그대로 쓴다 | 통과 | 변경은 `earnPoints`뿐이고 호출은 `createOrder`(`src/orders/order.js:35`) 한 곳이다. 영수증(`receipt.js:16`)과 `cancelOrder`는 저장값을 읽는다. 단 이를 직접 확인하는 새 테스트는 없다(지적 1) |
| `src/format/`의 영수증 출력이 바뀌지 않는다 | 통과 | `git diff b8bc0af -- src/format` 비어 있음, `test/receipt.test.js` 통과. O-1042 영수증도 적립 줄 값(237P)만 다르고 형식은 같다 |
| 적립 기준이 달라지는 경우(배송비, 쿠폰, 포인트 사용이 있는 주문)를 확인하는 테스트가 추가된다 | 통과 | `test/earn.test.js`: 배송비(O-0003), 쿠폰+포인트 사용(O-0004), O-1042(셋 모두), 버림, 0원 경계 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 기존 테스트 3개는 그대로 두고 테스트 4개만 추가했다(기존 부분 환불 기대값 100P도 그대로 통과).
- test/earn.test.js — 약화 아님 — 새로 추가한 파일이고 기존 테스트는 바뀌지 않았다. 수정 전 코드에서 4개가 실패해(fix.md) 수정을 실제로 잡아낸다.

## 남은 위험
- 적립 기준은 O-1042의 기대값 237P 하나로 추론한 것이다(문서 없음). 다른 주문의 고객센터 계산값으로 확인하지 못했다.
- 환불 회수 수정은 intent의 비목표(환불 회수 제외)를 사람 요청으로 넘어선 변경이다. 회수 합계가 적립값을 넘지 않는 것은 환불 가능 금액 검사 덕분이며, 나눠 환불하는 경우 `alreadyRefunded`가 수량만 있어 이전 회수값은 알 수 없다. 이미 옛 반올림 식으로 회수된 환불은 다시 계산하지 않는다.
- 선물하기 적립(`src/gift/gift-points.js`)은 옛 식(배송비 포함, 반올림)이다. 비목표.
