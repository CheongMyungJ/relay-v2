## 리뷰 지적
1. [권장] src/orders/refund.js:29-36 — 회수가 "저장된 적립 − 남은 상품 재계산 적립"이라 두 번째 이후 부분 환불은 누적 회수값이다. `alreadyRefunded`에 이전 회수 포인트가 없어 이전 환불에서 이미 회수했다면 중복 회수될 수 있다. 제안: 이전 환불 회수분을 입력에 받아 차감. 단 정산팀 규칙의 해석 변경이라 별도 확인 필요.
2. [사소] test/refund.test.js:34-50 — 다회차 부분 환불, 쿠폰·사용 포인트 없는 경계 케이스 테스트가 없다. 제안: 필요 시 추가.

## 반영
없음 (사람이 "반영하지 않음" 선택)

## 반영하지 않은 지적
- 1, 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (R-0311을 O-1077에 적용하면 132P) | 통과 | node로 createRefund(O-1077, R-0311) 직접 실행: pointsRecovered 132, refundAmount 13130 |
| `npm test`가 통과한다 | 통과 | npm test: 21개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | git diff 기준 test/refund.test.js는 케이스 추가만, 삭제·수정 없음 |
| 부분 환불의 환불 금액은 O-1077/R-0311에서 13,130원 그대로다 | 통과 | 재현 실행 refundAmount 13130, 새 테스트도 확인 |
| 회수 포인트는 저장된 `points.earned` 기준이고 덮어쓰지 않는다 | 통과 | refund.js `order.points.earned - remainingEarn`, 주문 객체 수정 없음 |
| 회수 계산의 버림은 환불 계산 안에서만 적용되고 `percentOf`는 그대로다 | 통과 | Math.floor는 refund.js 내부, src/money.js 변경 없음(git diff) |
| `src/format/` 파일은 변경되지 않는다 | 통과 | git diff 65a3a4f -- src/format 결과 비어 있음 |
| 위 규칙을 확인하는 테스트(O-1077/R-0311 포함)가 추가된다 | 통과 | test/refund.test.js 마지막 케이스, 132 단언 |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 새 케이스만 추가, 기존 케이스 그대로

## 남은 위험
- 다회차 부분 환불에서 이전 회수분 중복 회수 가능 (지적 1)
- 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/points/earn.js는 지금 반올림과 결제 금액 기준
