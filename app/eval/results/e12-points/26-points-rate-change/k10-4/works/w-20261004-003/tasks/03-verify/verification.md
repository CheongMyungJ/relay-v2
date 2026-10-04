## 리뷰 지적
1. [권장] README.md:10 — 삭제된 `POINT_RATE_PERCENT`를 적립률 상수로 안내한다. `EARN_RATE_PERCENT`/`REFUND_RATE_PERCENT`로 고치길 제안.
2. [사소] test/refund.test.js — 저장된 주문의 영수증 줄(`receiptLines`, `refundLines`)이 변경 전과 같음을 확인하는 테스트가 없다. `src/format/receipt.js`는 저장된 `points.earned`만 읽으므로 동작상 문제는 없다. 테스트 추가를 제안.

(수정이 원인에 맞는지: 원인은 비율·대상 금액(배송비 포함, 반올림)이었고 `earnPoints`가 대상 금액과 버림까지 고쳤다. 상수만 바꿔 증상만 가리지 않았다. 환불 상수 분리로 비목표도 지켰다.)

## 반영
- 1 — README.md 상수 이름을 `EARN_RATE_PERCENT`(환불 회수는 `REFUND_RATE_PERCENT`)로 수정. 커밋 138342e. `npm test`: 23개 통과, 0개 실패. 재현 절차는 바뀌지 않음.
- 팀 지식 `docs/knowledge/points/earn-rule.md`를 같은 경로에서 갱신(2% 규정, 환불 1% 유지 미정 사항, refund.js의 규정 불일치 기록). 같은 커밋.

## 반영하지 않은 지적
- 2 (사람이 고르지 않음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1107 주문 생성 시 `points.earned`가 486) | 통과 | `node src/cli.js examples/O-1107.json` → 적립 예정 486P (수정 전 273P). G-0213도 437P |
| `npm test`가 통과한다 | 통과 | `npm test` 23개 통과, 0개 실패 (최종 코드에서 직접 실행) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 삭제된 테스트 없음. 기대값 2건만 2% 적용으로 상향(500→1000, 300→600), 검증 강도 동일 |
| 선물하기 적립이 2% 기준으로 계산되는 테스트가 있다 | 통과 | test/gift.test.js의 G-0213 테스트(437P), 30,000원 선물 600P |
| 부분 환불 회수 포인트가 변경 전과 같은 값임을 확인하는 테스트가 있다 | 통과 | test/refund.test.js R-0311 → 131P. 기준 커밋 `src`로 되돌려 CLI 실행해도 131P로 같음(실행 후 복구) |
| 저장된 적립 포인트를 가진 주문의 영수증 줄이 변경 전과 글자 그대로 같다 | 통과 | `src/format/` 미변경, `receiptLines`가 저장된 `points.earned`(O-1077: 403P)만 출력함을 실행으로 확인. 전용 테스트는 없음(지적 2) |
| `src/format/` 아래 파일이 바뀌지 않았다 | 통과 | `git diff 0497e53 --stat -- src/format` 결과 없음 |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — 기대값 500→1000은 2% 적용 결과, O-1107 테스트 추가
- test/gift.test.js — 약화 아님 — 기대값 300→600은 2% 적용 결과, G-0213 테스트 추가
- test/refund.test.js — 약화 아님 — 환불 회수 불변 테스트만 추가

## 남은 위험
- 팀 지식은 R-0311 회수를 132P(정산팀 계산)로 적는데 코드는 1% 반올림으로 131P다. intent가 "지금 동작 그대로"라 두었고, 앞 Work(w-20261004-002)에서 고쳤을 수 있음(머지 대기). 머지 시 `src/orders/refund.js`, `src/points/earn.js` 충돌 가능.
- 환불 회수에 2%를 쓸지는 정산팀과 따로 정함.
- 영수증 글자 불변 전용 테스트 없음.
