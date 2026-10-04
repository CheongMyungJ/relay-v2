## 리뷰 지적
1. [권장] src/orders/refund.js:30-31 — 같은 주문에 부분 환불이 여러 번이면 "저장된 적립 − 남은 적립"이 이전 환불에서 이미 회수한 몫을 포함해 중복 회수될 수 있다. 입력에 이전 회수 포인트가 없어 의도 식 그대로 구현된 것이라 코드만으로는 못 고친다. 제안: 입력에 이전 회수분을 받거나 별도 Work에서 정산팀 기준을 확인한다.
2. [사소] test/refund.test.js — `Math.max(0, …)` 하한 분기(남은 적립이 저장된 적립보다 큰 경우)를 확인하는 테스트가 없다. 제안: 해당 입력 테스트 추가.
3. [사소] src/orders/refund.js:30 — `remainingEarn` 줄이 길다. 제안: 금액을 지역 변수로 나눈다.

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 "반영하지 않음" 선택, 의도 식 범위 밖이라 남은 위험으로 기록)
- 2 (사람이 선택하지 않음)
- 3 (사람이 선택하지 않음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1077 + R-0311 `createRefund`의 `pointsRecovered`가 132) | 통과 | 두 JSON을 읽어 `createRefund` 호출 → `pointsRecovered: 132`, 기준 커밋에서는 131이었다는 fix.md와 일치 (기준 커밋은 직접 실행하지 않고 코드 `percentOf(13130,1)=131`로 확인) |
| `npm test`가 통과한다 | 통과 | `npm test` → 21 pass / 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff c7beaa7 -- test`: test/refund.test.js에 테스트 추가만 있고 기존 줄 삭제·수정 없음 |
| 같은 입력에서 `refundAmount`가 변경 전과 같다 (13,130) | 통과 | 재현 실행 결과 `refundAmount: 13130`, diff에서 `refundAmount: refundGoods` 줄 변경 없음 |
| `src/format/`의 파일이 바뀌지 않는다 | 통과 | `git diff c7beaa7 --name-only -- src/format` 출력 없음 |
| 회수 포인트 계산이 `points.earned`를 쓰고 주문 금액으로 적립을 다시 계산하지 않는다 | 통과 | refund.js:31 `order.points.earned − remainingEarn`. 다시 계산하는 것은 남은 상품 기준 적립뿐이며 의도가 요구한 값 |
| 위 계산 규칙(남은 상품 기준 버림 차이)을 확인하는 테스트가 추가되어 통과한다 | 통과 | test/refund.test.js 새 테스트(132P, 반올림이면 272→131P로 달라지는 입력)가 `npm test`에서 통과 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 새 테스트 16줄 추가만 있고 기존 테스트와 단언은 그대로다

## 남은 위험
- 같은 주문에 부분 환불이 여러 번이면 중복 회수 가능성(지적 1). 테스트하지 않음
- `earnPoints`(`src/points/earn.js`)와 `percentOf`는 아직 반올림. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기
- `Math.max(0, …)` 하한 분기는 테스트가 없다
