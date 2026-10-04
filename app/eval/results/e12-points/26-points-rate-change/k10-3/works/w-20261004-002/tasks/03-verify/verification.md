## 리뷰 지적
1. [차단] src/orders/refund.js:30 — (사람 지적) 회수 포인트가 저장된 `points.earned`를 쓰지 않고 환불 전 상품으로 재계산해 이미 적립된 값을 다시 계산했다. 정산팀 규정은 저장된 earned − 남은 상품 기준 재계산 적립이다. 나눠 환불(`alreadyRefunded`)도 일관되게 처리할 것.
2. [사소] test/refund-points.test.js — 쿠폰·사용 포인트가 있는 주문의 나눠 환불 합 테스트가 없다.
3. [사소] src/points/earn.js:16 — `Math.floor((base * rate) / 100)`는 `POINT_RATE_PERCENT`가 소수면 부동소수점 오차 가능(현재 값 1이라 문제 없음).

## 반영
- 1 — 첫 환불은 환불 전 적립을 저장된 `earned`로, 이미 환불한 줄이 있으면(앞 환불이 저장값과의 차이를 이미 회수) 환불 전 상품 기준 적립(버림)으로 두고 남은 상품 기준 적립을 뺀다. 합 = earned − 최종 남은 적립. 커밋 43af7e9. 재현 절차 코드(`refund.js`)를 바꿨으나 절차 자체는 그대로(`node src/cli.js examples/R-0311.json --order examples/O-1077.json`) → 회수 -132P. `npm test` 23 pass. 저장 earned가 재계산과 다른 주문의 테스트 추가.
- 2 — 쿠폰 1건 있는 주문 테스트 추가. 커밋 752d48e. `npm test` 24 pass, 0 fail.

## 반영하지 않은 지적
- 3

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (R-0311 환불의 `pointsRecovered`가 132이다) | 통과 | 기준 커밋 코드에서는 -131P, 최종 코드에서 `node src/cli.js examples/R-0311.json --order examples/O-1077.json`은 -132P (earned 403 − 271). 재현 테스트 R-0311도 통과 |
| `npm test`가 통과한다 | 통과 | `npm test` 24 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기존 테스트 파일 변경 없음, 새 파일 test/refund-points.test.js만 추가 |
| 같은 주문의 환불 금액(`refundAmount`)과 영수증 출력은 수정 전과 같다 | 통과 | 기준 커밋과 최종 코드 모두 CLI 출력 `환불 금액 13,130원`. `src/format/`과 `refundAmount` 계산은 변경 없음. 회수 포인트 행만 -131→-132로 바뀜(의도한 변경) |
| 이미 적립된 포인트 값과 `cancelOrder` 결과는 수정 전과 같다 | 통과 | `earnPoints`·주문 생성 변경 없음. O-1077의 `cancelOrder`는 기준 커밋과 최종 코드 모두 `{refundAmount:40310, pointsRecovered:403, pointsReturned:2000}` |
| 나눠서 환불한 회수 포인트의 합이 전체 환불 때의 회수 포인트와 같다는 테스트가 있다 | 통과 | test/refund-points.test.js: 176P 합 테스트(전체 환불 176 = 나눠 환불 합), earned 불일치 주문과 쿠폰 주문의 합 테스트. 기준 커밋 코드에서는 첫 2개 테스트가 실패, 최종 코드에서 통과 |

## 테스트 파일 변경
- test/refund-points.test.js — 약화 아님 — 새로 추가한 파일이고 기존 테스트는 그대로다. 기준 커밋 코드에서는 실패하는 것을 확인.

## 남은 위험
- 사람이 말한 정산팀 규정(저장 earned 기준)은 intent 버전 1의 "원하는 결과"(전후 재계산 차이)와 문구가 다르다. R-0311은 둘 다 132P이고 저장값이 재계산과 같으면 결과가 같다. intent 문구는 갱신되지 않았다.
- 옛 기준으로 저장된 주문은 첫 부분 환불에서 저장값과 재계산값의 차이가 한 번에 회수된다(합은 earned − 최종 적립으로 맞음).
- 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earn.js에 같은 이름 `earnBase`/`pointsForBase`가 있으면 머지 충돌. `earnPoints`와 gift-points.js는 이 브랜치에서 아직 옛 반올림 기준.
- `POINT_RATE_PERCENT`가 소수가 되면 `pointsForBase` 부동소수점 오차 가능(지적 3).
