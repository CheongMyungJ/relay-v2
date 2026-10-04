## 리뷰 지적
1. [사소] test/gift.test.js:3-5 — `node:fs` import가 상대 경로 import 뒤에 있어 순서가 어긋난다. 동작에는 영향 없고 `node:` 내장 import를 앞으로 옮기면 된다.

## 반영
없음 (사람이 반영하지 않음을 선택)

## 반영하지 않은 지적
- 1

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213 적립 예정 포인트 계산)가 더 이상 실패하지 않는다. 결과가 218P다. | 통과 | fix.md의 재현 명령을 다시 실행: `{ used: 1000, earned: 218 }` |
| `npm test`가 통과한다. | 통과 | `npm test` 26 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다. | 통과 | `git diff f6cebd9`: test/gift.test.js는 테스트 2개와 import 2줄만 추가, 삭제·수정 없음 |
| 선물하기 주문의 `amounts`는 수정 전과 같다. | 통과 | 재실행 결과 goods 24860, coupon 2000, shipping 3000, pointsUsed 1000, total 24860. `amounts`를 만드는 코드(`gift-order.js`, `orders/order.js`)는 변경 없음 |
| 메시지 카드, 받는 사람 정보, `src/format/` 영수증 코드는 변경되지 않는다. | 통과 | `git diff f6cebd9 --name-only`: src/gift/gift-points.js, test/gift.test.js 두 개뿐 |
| 저장된 주문의 `points.earned`를 다시 계산하는 코드가 추가되지 않는다. | 통과 | diff에 재계산 코드 없음. `giftPoints`는 주문 생성 때만 호출된다 |
| 배송비가 있는 선물 주문과 없는 선물 주문 모두 적립이 일반 주문 `earnPoints`와 같은 값이라는 테스트가 있다. | 통과 | test/gift.test.js 마지막 두 테스트(배송비 3000인 G-0213 218P, 배송비 0인 319P)가 `earnPoints(g)`와 비교하고 `npm test`에서 통과 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 기존 테스트는 그대로이고 테스트 2개와 import 2줄만 추가했다.

## 남은 위험
- 다른 팀과 합의 없이 선물하기 적립 기준이 바뀌었다(사람이 선택). 머지 전 그 팀 확인이 필요하다.
- 부분 환불 회수(`src/orders/refund.js`)는 반올림이라 선물 주문 환불 때 적립과 회수가 1P 어긋날 수 있다.
- 적립 버림 규칙은 고객센터 사례 한 건에서 추론한 것이다.
