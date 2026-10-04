## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다: O-1107로 주문을 만들면 `points.earned`가 486이다 | 통과 | fix.md의 재현 명령을 다시 실행: `{ used: 1020, earned: 486 }` (수정 전 273) |
| `npm test`가 통과한다 | 통과 | `npm test` 23 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 삭제 없음. order/gift 기대값만 2배로 바뀜(아래 참고), 검증 강도 같음 |
| 적립률 값(`POINT_RATE_PERCENT`)이 2다 | 통과 | `src/config.js` 값 2, `test/earn.test.js`가 확인 |
| 선물하기 적립도 2%로 계산된다 | 통과 | `giftPoints`가 `earnPoints`에 위임, 선물 O-1107 입력 486 테스트 통과 |
| 부분 환불 회수 계산 결과는 이번 변경 전과 같다(기존 환불 테스트 통과) | 통과 | `refund.js`가 `REFUND_RECOVER_RATE_PERCENT = 1`로 변경 전과 같은 식. `test/refund.test.js` 통과 |
| `src/format/`의 영수증 출력 결과가 바뀌지 않는다(기존 영수증 테스트 통과) | 통과 | `git diff 44b9883 -- src/format` 변경 없음, `test/receipt.test.js` 통과 |
| 이미 저장된 `points.earned`와 ledger 값을 다시 계산하는 코드가 없다 | 통과 | grep: 적립 계산은 주문 생성(`order.js`, `gift-order.js`)에서만 호출. `cancelOrder`는 저장값 사용 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새 재현 테스트 3건(적립률, O-1107 486, 선물 486)
- test/order.test.js — 약화 아님 — 적립 기대값 500→1000. 50,000원 × 2%로 정책 반영, 단언 개수와 강도 그대로
- test/gift.test.js — 약화 아님 — 적립 기대값 300→600. 30,000원 × 2%로 정책 반영, 단언 그대로

## 남은 위험
- 부분 환불 회수는 적립률 2%와 어긋난 1%(정산팀과 협의 전)이고, 앞 Work(w-20261004-001)의 버림·순 금액 차이 방식은 이 브랜치에 없다. 머지 대기.
- 앞 Work가 `earn.js`를 이미 고쳤다면 머지 때 충돌할 수 있다.
