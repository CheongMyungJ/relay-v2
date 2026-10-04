## 리뷰 지적
1. [사소] test/gift.test.js:25-27 — 테스트 안에서 동적 import(readFileSync, createOrder)를 쓴다. 파일 상단 정적 import로 옮기면 읽기 쉽다.

## 반영
없음 (사람이 반영하지 않음을 골랐다)

## 반영하지 않은 지적
- 1

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (G-0213 적립 예정 포인트 218P) | 통과 | fix.md의 재현 명령을 다시 실행: `{ used: 1000, earned: 218 }` (수정 전 249). 원인(호출 식)을 고쳤고 증상만 가린 것이 아니다 |
| `npm test`가 통과한다 | 통과 | `npm test`: 25개 중 pass 25, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 45f5e22` 기준 test/gift.test.js에 케이스만 추가, 기존 줄 변경 없음 |
| `src/gift/gift-points.js`가 변경되지 않았다 | 통과 | `git diff 45f5e22 --stat -- src/gift/gift-points.js` 출력 없음 |
| 선물 메시지, 받는 사람 정보, 영수증 글자(`src/format/`) 출력이 변경 전과 같다 | 통과 | src/format 변경 없음. gift-order.js 변경은 import와 `points.earned` 한 줄뿐이고 메시지·받는 사람 코드는 그대로. 기존 gift 테스트 통과 |
| 이미 저장된 주문의 `points.earned`를 다시 계산하는 코드가 추가되지 않았다 | 통과 | 변경은 주문 생성 시 한 번 계산하는 호출뿐. 저장된 주문을 읽어 재계산하는 코드 없음 (`grep earned src`) |
| 일반 주문과 선물 주문의 적립 포인트가 달랐던 이유가 fix 결과에 적혀 있다 | 통과 | fix.md `## 원인`의 "일반 주문과 달랐던 이유" (order.js는 earnPoints, 선물은 giftPoints) |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — G-0213 재현 케이스 한 개만 추가했고 기존 케이스는 그대로다. 수정 전 실패(249), 수정 후 통과(218)

## 남은 위험
- 218P는 고객센터 값에서 거꾸로 맞춘 식이라 다른 주문으로는 검증되지 않았다
- `giftPoints`는 `src/index.js`에서 여전히 export되며 옛 식이다. 협의 후 정리 필요
- 옛 식으로 이미 저장된 선물 주문의 `points.earned`는 다시 계산하지 않았다 (비목표)
- 부분 환불의 `pointsRecovered`(src/orders/refund.js)는 적립 식과 달라 이번에 고치지 않았다 (비목표)
