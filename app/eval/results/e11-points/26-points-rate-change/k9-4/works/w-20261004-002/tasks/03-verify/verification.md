## 리뷰 지적
1. [권장] test/refund.test.js — 이전 환불이 있는 주문(alreadyRefunded)의 두 번째 환불 경로 테스트가 없다. 이 경로는 저장된 `points.earned` 대신 남은 금액으로 환불 전 적립을 재계산하므로 테스트로 고정하길 제안
2. [사소] src/orders/refund.js:20 — `Math.max(0, …)`가 음수 회수(저장된 earned와 규칙 계산의 불일치)를 조용히 가린다. 이유를 주석으로 남기길 제안

## 반영
- 1 — `test/refund.test.js`에 O-1077의 두 번째 환불(R-0312, TW-0838 1개, 이전 환불 SP-0656 2개) 테스트 추가. 환불 전 271P − 환불 후 188P = 83P. 커밋 46914ab. `npm test` 22 pass, 0 fail. 재현 절차는 바뀌지 않음

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(O-1077, R-0311 부분 환불)가 더 이상 실패하지 않는다. 회수 포인트가 132P이고 환불 금액은 그대로다 | 통과 | `createRefund(O-1077.json, R-0311.json)` 직접 실행: refundAmount 13130, pointsRecovered 132 (fix.md의 수정 전 131P와 비교) |
| `npm test`가 통과한다 | 통과 | `npm test` → 22 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 612e2ea -- test`: 추가만 있고 기존 테스트·단언 변경 없음 |
| 같은 주문의 부분 환불 회수 포인트가 `points.earned`를 다시 계산하지 않고 저장된 값을 쓴다 | 통과 | 첫 환불(`refundedBefore === 0`)은 `order.points.earned`(403)를 그대로 쓴다. 이전 환불이 있는 경우는 저장값이 이전 환불분을 반영하지 않아 재계산한다(남은 위험 참고) |
| 부분 환불 회수 포인트의 새 테스트를 `test/refund.test.js`에 추가한다. O-1077/R-0311 경우가 들어간다 | 통과 | 해당 파일에 O-1077/R-0311 테스트(132P)와 두 번째 환불 테스트가 있고 22개 모두 통과 |
| 영수증 글자(`src/format/`)의 출력이 바뀌지 않는다 | 통과 | `git diff 612e2ea --stat -- src/format` 변경 없음. `npm test`의 receipt 테스트 통과 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — `readFileSync` import와 새 테스트 2개만 추가. 기존 테스트와 단언은 그대로

## 남은 위험
- 이전 환불이 있는 주문은 환불 전 적립을 재계산하므로 `points.earned`를 그대로 쓰지 않는다. 저장값이 규칙과 다른 옛 주문(배송비 포함 반올림 기준)은 두 번째 환불부터 누적 1P 차이가 날 수 있다
- 앞 Work(w-20261004-001)에서 `earnBase`를 추가했을 수 있음, 머지 대기. 머지 때 refund.js 충돌 가능하며 그때 `earnBase`로 바꿔 쓰면 된다
- `Math.max(0, …)`로 음수 회수가 0으로 잘린다(지적 2, 반영하지 않음)
