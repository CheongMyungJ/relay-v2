## 리뷰 지적
1. [권장] src/orders/refund.js:36 — 이전 부분 환불(`alreadyRefunded`)이 있으면 저장된 `points.earned` 대신 직전 남은 상품의 재계산 적립을 기준으로 삼는다. 사람이 정한 식이 아니라 AI 가정이다. 정산팀 확인이 필요하다 (코드 변경 제안 없음).
2. [사소] src/orders/refund.js:6 — `earnOnRemaining`이 적립 식(상품−쿠폰−사용 포인트의 1% 버림)을 따로 구현한다. 이 브랜치에는 `earnBase`가 아직 없어(머지 대기) 지금은 어쩔 수 없고, 머지 뒤 재사용을 제안한다.
3. [사소] src/orders/refund.js:39 — 저장된 적립이 재계산 적립보다 작은 옛 주문이면 회수가 음수일 수 있다. 정상 데이터에서는 일어나지 않는다.

## 반영
없음 (사람이 "반영하지 않음"을 고름)

## 반영하지 않은 지적
- 1, 2, 3

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (examples/O-1077.json + examples/R-0311.json의 `pointsRecovered`가 132) | 통과 | fix.md의 재현 명령을 다시 실행: `pointsRecovered: 132` (수정 전 131) |
| `npm test`가 통과한다 | 통과 | `npm test`: 22개 중 pass 22, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff cbe98c1`에서 test/refund.test.js는 추가만 있고 기존 테스트 줄 변경·삭제 없음 |
| 부분 환불 회수를 위 계산식으로 검증하는 테스트가 있다 (쿠폰·사용 포인트가 있는 주문 포함) | 통과 | test/refund.test.js의 쿠폰 5,000·사용 포인트 2,000 주문(`orderWithDiscount`)으로 132P, 이전 환불 포함 83P를 검증 |
| `refundAmount`와 `src/format/`의 영수증 글자가 바뀌지 않는다 | 통과 | `git diff cbe98c1 --stat -- src/format` 변경 없음. `refundAmount: refundGoods` 줄은 그대로. 재현 출력 13130 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 테스트 2개 추가만 있고 기존 단언은 그대로다. 추가 테스트는 수정 전 실패(fix.md)

## 남은 위험
- 이전 부분 환불이 있을 때의 회수 계산은 AI 가정이다. 정산팀 확인이 필요하다 (지식 `## 아직 정하지 않은 것`에 기록).
- `earnOnRemaining`과 `earnBase`가 따로 있다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
