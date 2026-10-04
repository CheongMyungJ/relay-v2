## 리뷰 지적
1. [사소] src/money.js:13 — `percentOf`가 더는 어디서도 쓰이지 않는다고 봤으나, 환불 회수를 되돌린 지금은 `refund.js`가 다시 쓴다. 지적 해소.
2. [사소] src/gift/gift-points.js:5 — `giftPoints`가 `earnPoints`를 감쌀 뿐이다. 호출처(gift-order.js)를 유지하는 래퍼라 문제는 없음.
3. [차단] src/orders/refund.js — 부분 환불 회수까지 2%·기준액 방식으로 바뀌었다. 환불 회수 비율은 이번 범위가 아니고 정산팀과 따로 정하기로 해서 되돌려야 한다(사람 지시).

일반 주문·선물은 `earnBase`/`earnOnBase` 한 경로를 쓰고 적립률은 `POINT_RATE_PERCENT` 한 곳이다. 전체 취소와 `src/format/`은 변경 없음.

## 반영
- 3 — 사람이 `pointsRecovered`를 지금 동작 그대로 두라고 지시. `src/orders/refund.js`와 `test/refund.test.js`를 기준 커밋 상태로 되돌리고, 환불 회수 비율 1%를 `src/config.js`의 `REFUND_RECOVER_RATE_PERCENT`로 분리(적립률을 올려도 환불 회수가 바뀌지 않게). 환불 기준액 차이 회수 테스트는 삭제. 커밋: "부분 환불 회수는 기존 동작(1%)을 유지하고 적립만 2%로 바꾼다". `npm test`: 21개 통과, 0 실패. 재현 절차(O-1107)는 그대로 486P.

## 반영하지 않은 지적
- 1, 2 (사소. 동작에 영향 없어 반영하지 않음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1107의 적립 포인트가 486P) | 통과 | `createOrder(examples/O-1107.json)` → `points.earned` 486 (기준 커밋 소스에서는 273). |
| `npm test`가 통과한다 | 통과 | `npm test`: 21개 통과, 0 실패 (환불 테스트 1개 제거로 22→21). |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기존 테스트 삭제 없음. order·gift 기대값 2곳만 2% 정책에 따라 갱신. refund 테스트는 기준 커밋 그대로. |
| 일반 주문, 선물하기, 부분 환불 회수가 같은 적립 계산을 쓰고 적립률은 `POINT_RATE_PERCENT` 한 곳에서 정한다 | 실패 | 일반 주문·선물은 `earnPoints` 한 경로와 `POINT_RATE_PERCENT`를 쓴다. 부분 환불 회수는 사람 지시(정산팀과 협의, 이번 범위 아님)로 기존 방식(`REFUND_RECOVER_RATE_PERCENT` 1%, 반올림)을 유지해 intent와 다르다. |
| 저장된 `points.earned`가 있는 주문의 전체 취소와 영수증 결과가 변경 전과 같다 | 통과 | `cancelOrder`와 `src/format/receipt.js` 코드 변경 없음(저장값 사용). `npm test`의 취소·영수증 테스트 통과. |
| `src/format/`의 영수증 출력 글자가 변경 전과 같다 | 통과 | `git diff <기준 커밋> -- src/format` 비어 있음. receipt 테스트 통과. |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — 적립 기대값 500→1000(정책 변경)과 O-1107 = 486P 테스트 추가.
- test/gift.test.js — 약화 아님 — 기대값 300→600(정책 변경), 검증 조건 그대로.
- test/refund.test.js — 기준 커밋과 같음 — 되돌려서 `git diff <기준 커밋>`에 나타나지 않음.

## 남은 위험
- 부분 환불 회수는 1%·반올림 그대로라 적립(2%·버림)보다 적게 회수된다. 정산팀 결정 대기.
- 앞 Work(w-20261004-001)에서 earn.js/refund.js를 고쳤을 수 있음, 머지 대기: 머지 시 충돌 가능.
