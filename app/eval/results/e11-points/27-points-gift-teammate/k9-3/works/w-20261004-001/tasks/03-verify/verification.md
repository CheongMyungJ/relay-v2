## 리뷰 지적
1. [권장] src/orders/refund.js:34 — 부분 환불 회수 포인트가 `percentOf`(반올림)라 적립(버림)과 어긋날 수 있다. 환불 경로 수정이 필요해 이번 범위 밖이다.
2. [사소] test/earn.test.js — 버림 경계 전용 케이스는 없다. O-1042(237.7→237)가 버림을 이미 검증한다.

## 반영
없음 (사람이 "반영하지 않음"을 골랐다)

## 반영하지 않은 지적
- 1
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(O-1042 적립 예정 포인트 237P)가 더 이상 실패하지 않는다 | 통과 | `node src/cli.js examples/O-1042.json \| grep 적립` → `적립 예정 237P` (fix.md의 수정 전 268P와 비교). 기준 커밋의 earn.js로 되돌리면 test/earn.test.js가 실패함도 확인 |
| `npm test`가 통과한다 | 통과 | `npm test` 22개 중 22 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 0e2dc6e --stat`: 기존 테스트 파일 변경 없음, 새 파일 test/earn.test.js만 추가 |
| O-1042의 적립 예정 포인트가 237P임을 확인하는 테스트가 있고 통과한다 | 통과 | test/earn.test.js 첫 테스트가 `points.earned === 237`을 확인. 통과하고, 수정 전 코드에서는 실패함(pass 1 / fail 1) |
| 이미 저장된 주문의 `points.earned`를 읽는 경로(영수증, 환불)는 저장된 값을 그대로 쓴다 | 통과 | src/format/receipt.js:16, src/orders/refund.js:42가 `order.points.earned`를 읽음. 두 파일 모두 변경 없음 |
| `src/format/`과 `src/gift/gift-points.js`는 변경되지 않는다 | 통과 | `git diff 0e2dc6e --stat`에 두 경로 없음 (변경은 src/points/earn.js, test/earn.test.js) |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새로 추가한 파일이다. 기존 단언을 지우거나 느슨하게 바꾸지 않았고, 수정 전 코드에서 실패한다.

## 남은 위험
- 적립 기준(배송비 제외, 버림)은 O-1042 한 건에서 역산했다. 고객센터 계산 문서는 없다.
- 부분 환불 회수 포인트(src/orders/refund.js:34)는 반올림이라 적립과 1P 어긋날 수 있다.
- 선물하기 적립(src/gift/gift-points.js)은 옛 식(배송비 포함, 반올림) 그대로다. 비목표다.
