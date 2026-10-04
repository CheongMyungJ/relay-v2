## 리뷰 지적
1. [사소] test/gift.test.js:3-5 — import 순서(`node:fs`가 src import 뒤, `createOrder` 순서)를 정리하자는 제안. 동작에는 영향 없음.

원인 대응: `giftPoints`가 `earnPoints`를 쓰지 않고 총액을 반올림하던 것이 원인이며, 수정은 원인(규칙이 두 곳으로 갈라짐)을 고쳤다. 증상만 가린 것이 아니다. 목표·비목표 범위 안이다(`src/format/`, 환불, 메시지 카드 변경 없음).

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트가 249P로 나옴)가 더 이상 그렇게 나오지 않고, 같은 상품의 일반 주문 적립 포인트와 같다 | 통과 | fix.md의 재현 명령을 다시 실행: `{ used: 1000, earned: 218 }`. 일반 주문과 같음은 test/gift.test.js 새 테스트가 `createOrder`와 비교해 확인 |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 24, pass 24, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 9af3475 -- test`는 test/gift.test.js에 import 2줄과 테스트 1개 추가만 있고 삭제·수정 없음 |
| 선물 주문의 적립 포인트 계산에 대한 테스트가 추가되어 G-0213이 218P임을 확인한다 | 통과 | test/gift.test.js 마지막 테스트가 `g.points.earned === 218`을 단언하고 통과 |
| 선물 메시지 카드, 받는 사람 정보, `src/format/`의 영수증 출력이 이전과 같다 | 통과 | `git diff 9af3475 --name-only`에 src/gift/gift-points.js, test/gift.test.js만 있음. gift-order.js와 src/format/ 변경 없음 |
| 이미 저장된 주문의 `points.earned`는 다시 계산하지 않고 저장된 값을 쓴다 | 통과 | `giftPoints`는 `createGiftOrder`가 주문을 만들 때만 호출되고(src/gift/gift-order.js:36) 환불은 저장된 `order.points.earned`를 쓴다(src/orders/refund.js:42). 이 변경은 두 곳을 건드리지 않음 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 기존 테스트는 그대로이고 import와 G-0213 테스트만 추가됨

## 남은 위험
- 적립 규칙(배송비 제외, 내림)은 O-1042 한 건의 고객센터 값에서 추론한 기준이다.
- 적립 금액만 바뀌었다. 이미 만들어진 G-0213류 선물 주문의 저장값은 고치지 않았다(비목표).
- src/orders/refund.js:34 환불 회수 포인트는 비목표라 규칙과 다를 수 있다.
- src/gift/gift-points.js는 다른 팀과 같이 보는 중이라 수정이 겹칠 수 있다.
