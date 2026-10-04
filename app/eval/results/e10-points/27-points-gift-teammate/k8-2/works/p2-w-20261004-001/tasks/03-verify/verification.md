## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 환불 회수 포인트(`pointsRecovered`)가 `percentOf`(반올림)라 적립(`earnPoints`, 내림)보다 1P 더 회수될 수 있다. 환불 로직은 이번 intent 범위 밖이라 별도 Work를 권장한다.
2. [사소] src/gift/gift-points.js — `giftPoints`가 `earnPoints`를 그대로 감싸는 래퍼다. 동작 영향은 없다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음"을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트가 일반 주문과 다르게 나옴)가 더 이상 실패하지 않는다 | 통과 | `node src/cli.js examples/G-0213.json` → 적립 예정 218P. 수정 전 `gift-points.js`로 되돌리면 재현 테스트가 expected 218, actual 249로 실패(확인 뒤 복원) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 23, pass 23, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2b53998`에서 test/gift.test.js는 추가만 있고 삭제·수정된 기존 단언은 없다 |
| G-0213의 적립 예정 포인트가 같은 조건의 일반 주문과 같은 값(218P)이다 | 통과 | CLI 출력 218P. 테스트가 일반 주문 `createOrder`의 `points.earned`와 같음을 단언 |
| 선물하기 주문의 적립 포인트를 확인하는 테스트가 추가되어 있다 | 통과 | test/gift.test.js 마지막 케이스(G-0213, 218P) |
| 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)의 출력이 변경 전과 같다 | 통과 | 변경 파일은 `src/gift/gift-points.js`, `test/gift.test.js`뿐이고 `src/format/`, 메시지·받는 사람 코드는 diff에 없다. 다른 줄은 바뀌지 않았고 '적립 예정' 줄만 의도대로 249P에서 218P로 바뀐다 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 케이스 1개만 추가했고 기존 단언은 그대로다.

## 남은 위험
- 환불 회수 포인트(`src/orders/refund.js:34`)가 반올림이라 적립과 1P 차이가 날 수 있다(지적 1).
- 5ff61ae 이전의 적립 방식(반올림, 배송비 포함)이 고객센터와 맞춘 규칙이었는지는 코드로 알 수 없어 팀 확인이 필요하다. 이 Work는 `earn.js`를 바꾸지 않았다.
- 이미 249P로 적립된 G-0213 포인트는 의도대로 보정하지 않았다.
