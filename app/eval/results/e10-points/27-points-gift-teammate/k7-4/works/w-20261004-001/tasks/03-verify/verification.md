## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 부분 환불 회수(`percentOf(refundGoods, ...)`)가 옛 방식(상품 금액 반올림)이라 새 적립(쿠폰·포인트 차감 후 버림)과 어긋나, 적립보다 많이 회수될 수 있다. 회수 규칙(비례 배분 등)은 정해진 바 없어 별도 Work에서 사람이 정하는 것을 제안한다.

## 반영
없음 (사람이 반영하지 않음을 골랐다. 코드 변경 없음. 지식 문서만 `docs/knowledge/`에 커밋)

## 반영하지 않은 지적
- 1

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`node src/cli.js examples/O-1042.json`의 적립 예정이 237P) | 통과 | 직접 실행: `적립 예정 237P` 출력 (수정 전 268P, fix.md) |
| `npm test`가 통과한다 | 통과 | 직접 실행: 23개 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 5d6effe`: 테스트 파일은 신규 test/earn.test.js뿐, 기존 테스트 변경·삭제 없음 |
| 적립 계산(배송비 제외, 1P 미만 버림)을 확인하는 테스트가 추가되고, O-1042가 237P로 검증된다 | 통과 | `node --test test/earn.test.js` 3개 pass: O-1042=237, 배송비 제외 100P, 19,999원→199P 버림 |
| `src/format/`과 `src/gift/gift-points.js`는 변경되지 않는다 | 통과 | `git diff 5d6effe --stat -- src/format src/gift` 출력 없음 |
| 저장된 `points.earned` 값을 쓰는 영수증·환불(전체 취소)·포인트 내역 동작은 그대로다 | 통과 | 변경은 earn.js 한 함수뿐. refund.js의 cancelOrder와 영수증은 저장값을 읽고 수정 없음. `npm test` 통과 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 신규 파일. 기존 테스트는 건드리지 않았고, 수정 전 3개 모두 실패(fix.md)한 재현 테스트다.

## 남은 위험
- refund.js:34 부분 환불 회수와 src/gift/gift-points.js는 옛 반올림 방식이라 새 규칙과 어긋난다(비목표 또는 미반영).
- 이미 저장된 `points.earned`는 바꾸지 않아 이전 주문과 새 주문의 계산 기준이 다르다.
- 사용 포인트가 상품-쿠폰을 넘지 못한다는 가정(assertPointUse)에 기댄다. 음수 기준 금액 방어는 없다.
