## 리뷰 지적
1. [권장] test/refund.test.js:48 — "나눠 환불해도 회수 합계는 한 번에 환불한 것과 같다"가 수정 전 코드에서도 통과한다(66+66=132, 반올림 우연). 나눠 환불 로직을 잡지 못한다. 옛 식과 합계가 달라지는 입력(SP, SP, TW 순으로 3번: 새 식 215, 매번 반올림 216)으로 테스트를 추가할 것.
2. [사소] src/orders/refund.js:33 — 이전 환불이 옛 식(반올림)으로 회수됐다면 `recoveredBefore`를 새 식으로 가정해 1P 어긋날 수 있다. 코드 변경 없이 위험으로만 기록(fix.md risks에 있음).

## 반영
- 1 — 세 번 나눠 환불하는 테스트 추가(`test/refund.test.js` 하단). 커밋 06a8915. 수정 전 refund.js로 되돌려 실행하면 이 테스트와 첫 테스트가 실패(pass 21 / fail 2), 수정 후 `npm test` pass 23 / fail 0. 재현 절차는 바뀌지 않음.
- 팀 지식 `docs/knowledge/refund-recovery-vs-earn-basis.md`를 정산팀 식으로 고쳐 같은 커밋에 포함(앞 Work 내용의 상한·전체 취소·선물하기 항목은 유지).

## 반영하지 않은 지적
- 2 (사람이 차단·권장만 반영을 골랐다. 남은 위험에 기록)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1077/R-0311 `createRefund`의 `pointsRecovered`가 132) | 통과 | 예제 JSON을 읽어 `createRefund` 직접 실행: `pointsRecovered: 132`. 기준 커밋에서는 131(fix.md) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 23, pass 23, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff b8bc0af -- test`는 추가만(54줄 추가, 삭제 0) |
| 부분 환불 회수 포인트가 "저장된 적립 - 남은 상품 기준 재계산 적립(버림)"과 같다는 테스트가 있다 | 통과 | 테스트 3개(첫 환불 132, 두 번 나눠 합계 132, 세 번 나눠 합계 215). 수정 전 코드에서 첫 테스트와 세 번째 테스트 실패 확인 |
| 같은 주문에 대한 `refundAmount`와 영수증 출력은 수정 전과 같다 | 통과 | 실행 결과 `refundAmount: 13130`(수정 전 `refundGoods` 그대로). 변경 파일에 `src/format/` 없음, `refundAmount` 코드 줄 변경 없음 |
| 저장된 `points.earned`와 이미 처리한 환불(`alreadyRefunded`)은 다시 계산하지 않고 그대로 쓴다 | 통과 | `order.points.earned`를 그대로 읽고 `alreadyRefunded`는 기존 `refundedBefore` 계산만 사용. 저장값을 갱신하는 코드 없음 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 테스트 3개 추가만 있고 기존 테스트는 변경·삭제 없음

## 남은 위험
- 이미 처리한 환불이 옛 식(반올림)으로 회수됐으면, 이후 환불의 `recoveredBefore`를 새 식으로 가정해 1P 차이가 날 수 있다.
- `recoveredBefore`는 `refundedBefore > 0`일 때만 계산하며, 이전 환불 회수가 같은 식이었다는 가정에 의존한다.
- 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: `refund.js`와 `refund-recovery-vs-earn-basis.md`가 겹쳐 머지 시 충돌 가능.
- 선물하기 적립(`src/gift/gift-points.js`)은 범위 밖이라 옛 식일 수 있다.
