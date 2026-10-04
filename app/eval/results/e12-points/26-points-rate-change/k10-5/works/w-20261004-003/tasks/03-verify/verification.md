## 리뷰 지적
1. [사소] test/gift.test.js:14 — 선물하기 적립이 반올림(`percentOf`)을 유지하는지 보는 경계 케이스 테스트가 없다(기대값만 300→600). 경계 케이스 추가 제안.
2. [사소] test/order.test.js — 배송비 제외를 단독으로 보는 테스트(배송비 유무만 다른 두 주문의 적립 동일)가 없다. O-1107 테스트가 배송비 3,000원 포함 주문에서 486P(버림, 반올림이면 487)를 확인해 간접적으로는 잡는다.

그 밖에 목표·비목표 부합, 원인(상수 공유 + 기준 불일치) 대응, 환불 회수 분리(`REFUND_RECOVER_RATE_PERCENT`), `src/format/` 무변경을 확인했고 추가 지적은 없다.

## 반영
없음 (사람이 반영하지 않음을 선택). 코드 변경 없음. 지식 파일 `docs/knowledge/points/earn-basis.md`만 추가해 커밋.

## 반영하지 않은 지적
- 1
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`examples/O-1107.json`을 새로 주문하면 486P가 적립된다) | 통과 | `node src/cli.js examples/O-1107.json` → 적립 예정 486P (fix.md의 수정 전 273P와 비교) |
| `npm test`가 통과한다 | 통과 | `npm test` 22 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 삭제 없음. 바뀐 기대값 2건은 2% 반영으로 값이 커졌고 단언은 그대로(아래 참고) |
| 적립률 설정값이 2%이고, 새 주문 적립 계산이 2%를 쓴다 | 통과 | `src/config.js` `POINT_RATE_PERCENT = 2`, `src/points/earn.js`가 이를 사용. order 테스트 1000P·486P |
| 이미 저장된 `points.earned`가 있는 주문의 영수증 줄과 전체 취소 회수 포인트가 변경 전과 같다 | 통과 | `receiptLines`·`cancelOrder`는 저장값만 읽음(`src/format/receipt.js:16`, `refund.js`), 코드 무변경. receipt·cancel 테스트 통과(cancel 500P) |
| 선물하기 적립 포인트가 지금과 같은 기준과 반올림에 비율만 2%로 계산된다 | 통과 | `gift-points.js` 무변경. G-0213 결제 24,860원: 변경 전 249P → 후 497P (24,860×2%=497.2 반올림) |
| 부분 환불의 회수 포인트(`pointsRecovered`)가 변경 전과 같은 값이다 | 통과 | `node src/cli.js examples/R-0311.json --order examples/O-1077.json` 기준 커밋 f34a037과 현재 모두 131P. 보호 테스트(200P) 통과 |
| `src/format/` 아래 파일이 바뀌지 않는다 | 통과 | `git diff f34a037 --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — 기대값 500→1000은 적립률 2%의 의도된 반영이고 단언은 같다. O-1107(486P) 테스트가 추가됨
- test/gift.test.js — 약화 아님 — 기대값 300→600은 비율만 2%로 바뀐 의도된 결과(intent 비목표·원하는 결과)
- test/refund.test.js — 약화 아님 — 환불 회수 1% 유지를 보호하는 테스트만 추가

## 남은 위험
- 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기: 팀 지식은 부분 환불 회수를 "저장 earned − 남은 상품 재계산 적립"(R-0311 132P)으로 적었으나 이 브랜치의 `refund.js`는 `percentOf(refundGoods, REFUND_RECOVER_RATE_PERCENT)`로 131P를 낸다. 머지 시 `earn.js`·`refund.js` 충돌 가능, 재계산 방식이 들어오면 `REFUND_RECOVER_RATE_PERCENT` 사용처를 다시 정해야 한다.
- 환불 회수에 2%를 적용할지는 정산팀과 따로 정함(미정). 정하기 전까지 1% 상수가 남는다.
- 선물하기 적립은 배송비 포함·반올림 그대로 2%가 되어 일반 주문과 기준이 다르다(의도됨, 미정 사항).
