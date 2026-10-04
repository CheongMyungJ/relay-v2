## 리뷰 지적
1. [권장] src/gift/gift-order.js:36 — 선물하기 주문이 `points.ratePercent`를 저장하지 않아 부분 환불이 옛 1%로 재계산된다. 30,000원 선물(적립 600P)에서 15,000원 줄 하나를 환불하면 회수 450P(2% 기준 300P). 주문 생성 때 `ratePercent`를 저장하도록 제안(적립 계산 방식은 그대로).
2. [사소] test/earn-rate.test.js — `createOrder`가 `points.ratePercent`를 저장하는지 직접 검증하는 테스트가 없다.

## 반영
- 1 — `src/gift/gift-order.js`에 `ratePercent: POINT_RATE_PERCENT` 저장 추가, `test/gift.test.js`에 선물 주문 부분 환불 테스트 추가(회수 300). 커밋 68fb9ac. `npm test`: 28개 통과, 0 실패. 재현 절차는 바뀌지 않음. 팀 지식 `docs/knowledge/points/earn-basis.md`도 같은 커밋에서 갱신.

## 반영하지 않은 지적
- 2 (사람이 고르지 않음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1107로 주문을 만들면 `points.earned`가 486이다) | 통과 | 재현 명령을 직접 실행: 486. `test/earn-rate.test.js`의 O-1107 테스트도 통과 |
| `npm test`가 통과한다 | 통과 | `npm test`: 28 tests, 28 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 (적립률 변경으로 달라지는 기대값만 새 비율에 맞게 고친다) | 통과 | 바뀐 기존 테스트는 기대값만 2배로 조정, 삭제·단언 제거 없음. 아래 테스트 파일 변경 참고 |
| 적립률 설정값이 2이다 | 통과 | `src/config.js:9` `POINT_RATE_PERCENT = 2`, 테스트 '적립률 설정값은 2' 통과 |
| 저장된 `points.earned`를 가진 주문의 전체 취소 회수 포인트는 저장된 값 그대로다 | 통과 | `cancelOrder(O-1077)` 회수 403(저장값), `test/refund.test.js` 전체 취소 1000(저장값) 통과 |
| `src/format/`의 파일이 바뀌지 않았고 영수증 테스트가 그대로 통과한다 | 통과 | `git diff b7eefd5 --stat -- src/format` 출력 없음, `npm test` 전체 통과 |

## 테스트 파일 변경
- test/earn-rate.test.js — 약화 아님 — 새로 추가한 재현·회귀 테스트
- test/order.test.js — 약화 아님 — 적립 기대값 500→1000, 2% 적립률에 따른 값만 수정
- test/gift.test.js — 약화 아님 — 기대값 300→600(2%), 선물 주문 부분 환불 테스트 추가
- test/refund.test.js — 약화 아님 — 픽스처 earned 500→1000과 `ratePercent: 2`, 회수 기대값 100→200·500→1000. 새 비율에 맞춘 값만 수정, 검증 항목은 그대로

## 남은 위험
- 선물하기 적립률을 일반과 같이 2%로 올릴지는 미정. 지금은 공유 상수를 따라 2%
- 적립률 변경 전 저장된 주문은 모두 1%였다고 가정(`LEGACY_POINT_RATE_PERCENT`)
- 앞 Work(w-20261004-002)에서 `earnPoints`와 `refund.js`를 고쳤을 수 있음, 머지 대기. 머지 시 같은 파일이 겹칠 수 있다
- 저장 주문에 `points.ratePercent` 필드가 새로 생겨 저장 형식이 늘었다
- 지적 2는 반영하지 않음: `ratePercent` 저장은 환불 테스트로 간접 검증됨
