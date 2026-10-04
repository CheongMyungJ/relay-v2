## 리뷰 지적
1. [권장] README.md:10 — 삭제된 `POINT_RATE_PERCENT`를 적립률 위치로 안내하고 있음. `EARN_RATE_PERCENT`와 `src/points/earn.js`로 안내하도록 고칠 것.
2. [사소] src/points/earn.js:9 — 기준 금액이 음수면 `Math.floor`가 음수 적립을 만들 수 있음. 0 하한을 제안. 현재 주문 생성 입력으로는 발생하지 않음.

## 반영
- 1 — README.md의 적립률 안내를 `EARN_RATE_PERCENT`, `src/points/earn.js`로 수정. 커밋 7fef5e0(팀 지식 docs/knowledge/points/earn-rule.md, refund-recover-rate.md 포함). `npm test` → 25개 통과, 0 실패. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | fix.md의 재현 명령을 다시 실행: `27330 486` 출력(기대 486P). `test/earn.test.js` 5건 통과 |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 25, pass 25, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 삭제된 테스트 없음. order/gift 기대값 변경 2건은 아래 판단 참고 |
| O-1107의 적립 포인트가 486P로 계산된다 | 통과 | 재현 명령 출력 486, `test/earn.test.js` O-1107 테스트 통과 |
| 이미 저장된 주문의 `points.earned`가 바뀌지 않는다 | 통과 | `earnPoints`/`giftPoints` 호출은 `order.js:35`, `gift-order.js:36`의 주문 생성 시점뿐. 영수증·환불은 저장 값만 읽음(grep 확인). 저장 주문을 재계산하는 코드 없음 |
| `src/format/`의 파일이 변경되지 않고 영수증 테스트가 그대로 통과한다 | 통과 | `git diff b454f0f --stat -- src/format` 출력 없음. `node --test test/receipt.test.js` → pass 1, fail 0 |
| 2% 적립률이 일반 주문, 선물하기 적립 경로에 일관되게 반영됨을 테스트로 확인한다 | 통과 | `test/earn.test.js`: 일반 주문 O-1107 486P, 선물하기 486P, 배송비 제외 400P. 선물하기는 `earnPoints`에 위임 |
| 환불 회수 포인트 계산 결과가 변경 전과 같다 | 통과 | `refund.js`는 `REFUND_RECOVER_PERCENT=1`로 이전과 같은 `percentOf` 반올림. `test/earn.test.js` 회수 250P 테스트 통과, 기존 refund 테스트 통과. 전체 변경 전 코드와의 대조 실행은 하지 않음 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새 파일. O-1107 486P, 배송비 제외, 선물하기, 회수 불변을 검증
- test/order.test.js — 약화 아님 — 50,000원 주문 적립 기대값 500→1000. 2% 요구에 맞춰 강화된 기대값이며 검증 대상은 그대로
- test/gift.test.js — 약화 아님 — 30,000원 선물 적립 기대값 300→600. 같은 이유

## 남은 위험
- 환불 회수는 1% 반올림 그대로라 적립 2%와 불일치. 정산팀 결정 대기(비목표)
- 지적 2(음수 기준 금액)는 미반영
- 앞 Work(w-20261004-001/002)에서 환불 회수 규정을 고쳤을 수 있음, 머지 대기. 같은 파일(`refund.js`)을 건드려 머지 시 충돌 가능
