## 리뷰 지적
1. [사소] test/earn.test.js — 쿠폰이 있는 주문의 부분 환불, 나눠서 한 환불(alreadyRefunded) 테스트가 없음
2. [사소] src/points/earn.js:5 — `earnBase`의 `Math.max(0)` 경계(상품 < 쿠폰+사용 포인트)를 확인하는 테스트가 없음
3. [사소] src/orders/refund.js:34 — 부분 환불 회수가 저장된 `points.earned`(옛 반올림 값)를 넘을 수 있음. 상한 없음

## 반영
- 1 — `test/earn.test.js`에 쿠폰 있는 부분 환불(200P), 나눈 환불(99P) 테스트 추가. 커밋 1678c3b
- 2 — `earnBase`/`earnPoints`가 0이 되는 경계 테스트 추가. 커밋 1678c3b
- 3 — `refund.js:34`를 `Math.min(floorPercentOf(...), order.points.earned)`로 제한하고 테스트 추가. 커밋 1678c3b. 재현 절차(createOrder)가 쓰는 코드는 바꾸지 않아 절차는 그대로
- 테스트: `npm test` 28 pass, 0 fail
- 지식: `docs/knowledge/points/earn-rule.md` 추가(별도 커밋)

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1042 = 237P) | 통과 | fix.md의 재현 명령을 다시 실행: 출력 237 (수정 전 268) |
| `npm test`가 통과한다 | 통과 | `npm test`: 28 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 이후 바뀐 테스트 파일은 새 파일 `test/earn.test.js`뿐. 기존 테스트 파일 변경 없음 |
| 배송비 있는/없는 주문 모두 (상품 − 쿠폰 − 포인트) × 1% 버림 | 통과 | `test/earn.test.js` O-1042(배송비 3,000 → 237), 배송비 0(→ 489) 통과 |
| 선물하기 적립이 같은 기준 | 통과 | G-0213 → 218P 테스트 통과. `giftPoints`는 `earnPoints`에 위임 |
| 환불 회수 포인트가 같은 기준 (전체 취소는 저장값 그대로) | 통과 | 부분 환불 버림 테스트(59, 200, 99)와 기존 `cancelOrder` 테스트(500) 통과. `cancelOrder` 코드 변경 없음 |
| 저장된 `points.earned`를 읽는 영수증·내역 출력은 글자 하나 다르지 않다 | 통과 | `git diff cbe98c1 -- src/format` 비어 있음, `test/receipt.test.js`·`ledger.test.js` 통과 |
| 위 계산을 확인하는 테스트(O-1042 = 237P 포함)가 추가된다 | 통과 | `test/earn.test.js`에 8건 추가, O-1042 = 237 포함 |

## 테스트 파일 변경
- test/earn.test.js — 약화 아님 — 새 파일이며 기존 테스트를 바꾸지 않음. 수정 전 코드에서 4건 실패함을 fix 단계에서 확인

## 남은 위험
- 상한(`Math.min`)은 여러 번 나눈 환불의 회수 합계까지 막지는 않음(건별로만 저장된 적립값 이하)
- intent의 "상품 25,270원"은 실제 28,270원(쿠폰 3,000 포함)이며 결과 237P는 같음
- 기존에 반올림으로 저장된 주문은 다시 계산하지 않음(비목표)
