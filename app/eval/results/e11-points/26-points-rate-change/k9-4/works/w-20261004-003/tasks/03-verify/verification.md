## 리뷰 지적
1. [사소] src/orders/refund.js:34 — 환불 회수가 `percentOf`(반올림)+1% 고정이라 팀 지식(적립 전후 차이)과 다르다. 사람이 이번 범위에서 뺐고 intent 비목표이므로 코드는 바꾸지 않고 지식의 '아직 규칙을 따르지 않는 곳'에 기록하자는 제안.
2. [사소] test/order.test.js — O-1107 테스트는 일반 주문 경로만 검증한다. 선물하기(`giftPoints`)의 배송비 제외는 따로 검증하지 않는다. `giftPoints`가 `earnPoints`를 그대로 쓰므로 위험은 낮다. 테스트 1건 추가 제안.

차단·권장 지적은 없다. 변경은 원인(배송비 포함 total, 반올림, 환불이 적립률 상수를 직접 사용)과 맞고 증상만 가리지 않는다. `earnBase`는 `assertPointUse` 덕에 음수가 되지 않는다.

## 반영
없음 (사람이 "반영하지 않음"을 골랐다). 1번의 지식 기록은 지식 남기기 절차로 따로 했다(docs/knowledge 커밋, 코드 변경 없음).

## 반영하지 않은 지적
- 1, 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1107의 적립 포인트가 486P) | 통과 | `node src/cli.js examples/O-1107.json` → "적립 예정 486P". 기준 커밋(worktree)에서는 273P였다 |
| `npm test`가 통과한다 | 통과 | `npm test` 21 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 삭제 없음. 바뀐 기대값 2건은 아래 판단 참고 |
| 적립 계산에 2%가 적용된다 | 통과 | `src/config.js` `POINT_RATE_PERCENT=2`, `pointsOf`가 사용. O-1107 486P(24330×2%, 버림), order 테스트 50000→1000P |
| 환불 회수 포인트 계산 결과가 변경 전과 같다 (기존 환불 테스트와 `examples/R-0311.json` 기준) | 통과 | `node src/cli.js examples/R-0311.json --order examples/O-1077.json`을 기준 커밋과 현재에서 돌려 diff 없음(회수 -131P). `test/refund.test.js`는 변경 없이 통과 |
| 이미 적립된 포인트(저장된 `points.earned`)는 적립률을 바꿔도 값이 달라지지 않는다 | 통과 | `cancelOrder`는 변경 없이 `order.points.earned`를 쓴다. 저장값 500인 주문에서 `pointsRecovered` 500 유지(`test/refund.test.js` 통과) |
| `src/format/`의 파일이 변경되지 않고 영수증 글자 출력이 그대로다 | 통과 | `git diff 612e2ea --stat -- src/format` 비어 있음. `test/receipt.test.js` 통과, 영수증 줄 형식은 기준 커밋과 같고 적립 값만 다름 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 적립 기대값 300→600. 30000원 주문에 2%를 적용한 값으로, 검증 범위는 그대로다.
- test/order.test.js — 약화 아님 — 기존 기대값 500→1000(50000원, 2%)로 같은 검증을 새 정책 값에 맞췄다. O-1107 테스트를 새로 추가해 배송비 제외·버림을 더 단단히 검증한다.

## 남은 위험
- 환불 회수는 반올림·1% 고정이라 팀 지식과 다르다. 정산팀 협의 전까지 의도된 상태다.
- 앞 Work(w-20261004-001)에서 `earnBase`를 이미 고쳤을 수 있다(머지 대기). 머지 때 `src/points/earn.js`와 `docs/knowledge/points/earn-rule.md` 충돌 가능.
- 재현 테스트를 수정 전 코드에 직접 돌려 실패를 확인하지는 않았다. 같은 입력의 수정 전 결과(273P)는 기준 커밋에서 확인했다.
