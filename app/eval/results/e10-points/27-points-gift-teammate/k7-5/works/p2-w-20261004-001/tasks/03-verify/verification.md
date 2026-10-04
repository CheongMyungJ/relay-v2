## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (examples/G-0213.json으로 선물 주문을 만들면 적립이 218P) | 통과 | fix.md의 재현 명령을 다시 실행: `{ used: 1000, earned: 218 }` (수정 전 249) |
| `npm test`가 통과한다 | 통과 | `npm test` 23개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | test/gift.test.js는 import와 새 테스트만 추가, 삭제·수정 없음 |
| 일반 주문 적립 결과(earnPoints)와 같은 상품·금액의 선물 주문 적립 결과가 같다 | 통과 | `giftPoints`가 `earnPoints`를 그대로 호출. 새 테스트가 `g.points.earned === earnPoints(g)` 확인 |
| src/gift/gift-points.js 외의 소스 파일(src/money.js, src/format/ 등)은 바뀌지 않는다 | 통과 | `git diff 071a409 --stat`: 소스는 src/gift/gift-points.js 하나 (그 외 테스트와 docs/knowledge 문서) |
| 선물 메시지와 받는 사람 정보, 영수증 출력은 수정 전과 같다 | 통과 | gift-order.js와 src/format/ 변경 없음, 메시지·받는 사람 필드는 그대로. 영수증에 보이는 적립 값만 새 규칙으로 바뀌며 이는 목표 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 기존 3개 테스트는 그대로, G-0213 재현 테스트만 추가(수정 전 249로 실패)

## 남은 위험
- 선물하기 적립은 다른 팀이 같이 보는 중이고 합의 여부는 확인되지 않았다.
- `giftPoints`가 `earnPoints`에 묶여, earn.js가 바뀌면 선물 적립도 함께 바뀐다.
- 선물 주문 부분 환불 회수(refund.js)는 반올림이라 1P 어긋날 수 있다(비목표).
