## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 부분 환불 회수 포인트(`pointsRecovered`)가 여전히 상품 금액의 반올림(`percentOf`)이라 새 적립 기준(내림)과 어긋날 수 있다. 수정 범위가 `earn.js` 밖이고 intent에 없다.
2. [사소] test/earn.test.js — 반올림과 내림이 갈리는 경계 사례가 없었다. 배송비 0 사례(40,310원 → 403.1)는 반올림해도 403이라 내림을 검증하지 못했다. 40,370원(403.7)으로 바꾸자고 제안.

## 반영
- 2 — 배송비 0 사례를 40,370원(403.7 → 내림 403, 반올림이면 404)으로 바꿨다. 커밋 394270a. `npm test` 22개 통과. 임시로 `Math.floor`를 `Math.round`로 바꿔 보니 테스트 2개가 실패해 수정을 잡아냄을 확인했고, 원복했다. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 1 (사람이 고르지 않음. 범위 밖이라 남은 위험에 기록)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`node src/cli.js examples/O-1042.json`)에서 적립 예정 포인트가 237P로 나온다 | 통과 | 직접 실행: `적립 예정 237P` (fix 전 268P, fix.md의 재현 기록과 비교) |
| `npm test`가 통과한다 | 통과 | 직접 실행: tests 22, pass 22, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 이후 바뀐 테스트 파일은 새 파일 `test/earn.test.js`뿐이다. 기존 테스트는 수정·삭제 없음 |
| 이미 저장된 주문의 `points.earned` 값은 그대로 쓰이며 다시 계산되지 않는다 | 통과 | `earnPoints` 호출은 `src/orders/order.js:35`(주문 생성)뿐이다. `refund.js`의 `cancelOrder`는 `order.points.earned`를 그대로 읽고 `format/receipt.js`도 저장값을 출력한다 |
| `src/format/`과 `src/gift/gift-points.js`는 변경되지 않는다 | 통과 | `git diff e648d57 --stat -- src/format src/gift` 결과 없음 |
| 이 수정을 확인하는 테스트가 추가된다 | 통과 | `test/earn.test.js` 2개. 직접 `Math.floor`를 `Math.round`로 바꾸자 2개 모두 실패했다 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새로 추가한 파일이며 기존 테스트는 건드리지 않았다. 검증을 강화하는 방향으로 고쳤다.

## 남은 위험
- `src/orders/refund.js:34` 부분 환불 회수 포인트가 반올림이라, 새 적립(내림)과 1P 차이가 날 수 있다. 별도 Work로 확인이 필요하다.
- `src/gift/gift-points.js`는 선물 주문 적립이 배송비 포함·반올림이다. 비목표라 그대로이며 일반 주문과 값이 달라진다.
- 산식 문서가 없어 O-1042 한 건(237P)으로만 대조했다. 다른 주문의 안내 값은 확인하지 못했다.
