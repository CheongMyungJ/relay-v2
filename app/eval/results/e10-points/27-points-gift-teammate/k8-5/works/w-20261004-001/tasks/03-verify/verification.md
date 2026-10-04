## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 부분 환불의 `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`(상품 금액 기준, 반올림)라 새 적립 식(배송비 제외, 버림)과 기준이 달라 적립보다 1P 더 회수할 수 있다. 회수 식을 맞출지는 환불 정책 확인이 필요하고 intent 목표(적립 예정 포인트) 밖이다.
2. [사소] test/earn.test.js — O-1077 케이스는 수정 전에도 통과하는 회귀용이다. 적립 0P 같은 경계 케이스는 없다.

## 반영
없음 (사람이 반영하지 않기로 함)

## 반영하지 않은 지적
- 1, 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `node src/cli.js examples/O-1042.json` → 적립 예정 237P (수정 전 268P). |
| `npm test`가 통과한다 | 통과 | `npm test` → 24개 통과, 0개 실패. |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff e49c6e0 --name-only`: 바뀐 파일은 src/points/earn.js와 새 test/earn.test.js뿐. 기존 테스트 파일 변경 없음. |
| O-1042의 적립 예정 포인트가 237P이다 | 통과 | CLI 출력 237P, O-1077=423, O-1107=243. |
| 적립 예정 포인트 계산 결과를 검증하는 테스트가 추가되어 있다 | 통과 | test/earn.test.js 4개. 수정 전 earn.js로 되돌려 실행하면 4개 모두 실패, 수정 후 4개 통과. |
| 주문에 저장된 기존 적립 포인트 값을 다시 계산하는 코드가 없다 | 통과 | `grep earnPoints src`: 호출은 order.js 주문 생성 한 곳뿐. refund.js와 receipt.js는 저장된 `points.earned`를 읽는다. |
| `src/format/`과 `src/gift/gift-points.js`는 변경되지 않았다 | 통과 | `git diff e49c6e0 --name-only`에 해당 경로 없음. |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새로 추가한 파일이고 기존 테스트는 바뀌지 않았다.

## 남은 위험
- 237P 식(배송비 제외, 버림)은 고객센터 값에서 거꾸로 맞췄고 정책 문서가 없다. O-1077, O-1107은 고객센터 값으로 확인하지 않았다.
- 환불 회수 포인트(refund.js:34)와 선물하기 적립(gift-points.js)은 옛 기준(반올림)이라 적립과 어긋난다. 후자는 비목표다. 둘 다 `docs/knowledge/points/`에 기록했다.
