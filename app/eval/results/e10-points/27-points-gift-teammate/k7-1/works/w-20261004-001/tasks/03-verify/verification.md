## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 부분 환불 `pointsRecovered`가 반올림 `percentOf`라 적립(버림)보다 많이 회수될 수 있다(1,990원 → 적립 19P, 회수 20P). `Math.floor`로 맞추기를 제안. 이번 변경의 원인(earnPoints)과 별개이고 환불 코드는 intent 범위 밖이다.
2. [사소] test/earn.test.js — 쿠폰·사용 포인트 차감만 따로 보는 경계 케이스가 없다(O-1042 테스트가 간접 확인).

변경 자체는 intent의 목표와 비목표에 맞고, 원인(배송비 포함 total + 반올림)을 직접 고쳤다. 증상만 가린 것이 아니다.

## 반영
없음 (사람이 반영하지 않음을 선택)

## 반영하지 않은 지적
- 1, 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다(O-1042 적립 예정이 237P) | 통과 | `node src/cli.js examples/O-1042.json` → 적립 예정 237P |
| `npm test`가 통과한다 | 통과 | `npm test` → 23개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 이후 테스트 파일은 신규 test/earn.test.js뿐, 기존 파일 변경 없음 |
| 배송비를 뺀 기준 금액과 소수점 버림을 확인하는 테스트가 추가된다 | 통과 | test/earn.test.js의 배송비 제외(200P), 버림(19P), O-1042(237P) 테스트 3개 |
| `src/gift/`와 `src/format/` 아래 파일이 바뀌지 않는다 | 통과 | `git diff e8432d9 -- src/gift src/format` 출력 없음. 변경 파일은 src/points/earn.js, test/earn.test.js |
| 저장된 `points.earned`를 쓰는 환불·포인트 내역·영수증 경로는 값을 다시 계산하지 않는다 | 통과 | cancelOrder(refund.js:42)와 receipt.js:16은 `order.points.earned`를 그대로 쓴다. earnPoints 호출은 order.js:35(주문 생성)뿐. 부분 환불(refund.js:34)은 저장값을 쓰는 경로가 아니라 원래부터 재계산(지적 1 참고) |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 신규 파일이고 기존 테스트는 바뀌거나 삭제되지 않았다.

## 남은 위험
- 부분 환불 회수 포인트(refund.js:34)가 반올림이라 적립보다 1P 많을 수 있다.
- 선물하기 적립(gift-points.js)은 비목표라 같은 차이가 남아 있다.
- O-1042 외 다른 주문은 안내 기준과 직접 대조하지 않았다.
