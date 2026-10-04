## 리뷰 지적
1. [권장] test/refund.test.js — 저장된 `points.earned`와 재계산 값이 다른 경우, 그리고 `alreadyRefunded`가 있는 연속 부분 환불을 검증하는 테스트가 없다. 테스트 추가를 제안한다.
2. [차단] src/orders/refund.js:37 (리뷰 당시) — 회수 포인트가 환불 전 적립도 `earnFromAmounts`로 다시 계산한다. 이미 저장된 `points.earned`는 재계산하면 안 된다. 저장된 `points.earned`에서 남은 상품의 적립(`earnFromAmounts`)을 빼도록 제안한다. (사람이 반영 시점에 지적함)
3. [사소] src/orders/refund.js — `pointsRecovered` 한 줄이 길다. 변수로 나누길 제안한다. (2번 수정에서 함께 해소됨)

## 반영
- 1번 — 테스트 2개 추가(저장된 earned 450 ≠ 재계산 430일 때 220P 회수, `alreadyRefunded`가 있을 때 `refundAmount` 10000). 커밋 b2ce51e. `npm test` → 23 pass, 0 fail.
- 2번 — `createRefund`가 `order.points.earned - earnFromAmounts(남은 상품, 쿠폰, 사용 포인트)`를 회수하게 고쳤다. 커밋 b2ce51e. 재현 절차(`node src/cli.js examples/R-0311.json --order examples/O-1077.json`)는 그대로이며 -132P 출력. 팀 지식 `docs/knowledge/points/stored-earned-not-recalculated.md`에 부분 환불 회수 규칙을 더했다.
- 3번 — 2번 수정으로 `remainingEarn` 변수로 나뉘어 해소.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(O-1077 / R-0311 부분 환불)가 더 이상 실패하지 않는다: 회수 포인트가 132P다 | 통과 | `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 환불 금액 13,130원, 포인트 회수 -132P |
| `npm test`가 통과한다 | 통과 | `npm test` → 23 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2e94d09 -- test`에서 기존 줄 변경·삭제 없음, 추가만 있음 |
| R-0311의 `refundAmount`는 변경 전과 같다 | 통과 | CLI 출력 13,130원, 테스트 `refundAmount === 13130` 통과 |
| `src/format/`의 파일과 `cancelOrder`의 결과는 변경되지 않는다 | 통과 | `git diff 2e94d09 -- src/format` 비어 있음, `cancelOrder` 코드 변경 없음, 기존 전체 취소 테스트 통과 |
| 부분 환불에서 회수 포인트가 어긋나던 경우(쿠폰·사용 포인트가 있는 주문)를 검증하는 테스트가 추가된다 | 통과 | test/refund.test.js에 O-1077/R-0311(132P)과 저장 earned 450 → 220P 테스트가 있다 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 테스트 3개를 추가했을 뿐 기존 테스트와 단언은 그대로다.

## 남은 위험
- `alreadyRefunded`가 있는 연속 부분 환불에서는 `earned − 남은 적립`이 앞선 환불에서 이미 회수한 몫까지 포함해 중복 회수할 수 있다. 입력에 이전 회수 포인트가 없어 이번 범위에서 풀지 않았고, 이 경우 `pointsRecovered`는 테스트로 고정하지 않았다.
- `earnPoints`(저장 적립)는 배송비 포함 결제 금액 기준이라, 배송비가 있는 주문은 저장 `earned`와 `earnFromAmounts`의 기준이 다를 수 있다.
- 앞 Work(w-20261004-001)에서 `earnFromAmounts`를 이미 만들었을 수 있음, 머지 대기. 머지 시 src/points/earn.js 충돌 가능.
