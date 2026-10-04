## 리뷰 지적
1. [권장] test/refund.test.js:44 — 다회 환불 테스트가 `total <= earned` 상한만 확인해, 회수 계산이 틀려도(예: 항상 0) 통과한다. 합계가 정확한 값(344P)인지도 확인하도록 보강하는 것을 제안한다.
2. [사소] src/orders/refund.js:41 — `order.amounts.goods - refundedBefore`(환불 전 남은 상품 금액)를 이름 붙은 변수로 빼면 읽기 쉽다.

## 반영
- 1번 — 다회 환불 테스트에 `total === 344` 단언 추가(커밋 6f3bca8). 추가하자 345P로 실패했는데, 원인은 코드가 아니라 테스트였다. 같은 sku(SP-0656)를 두 줄로 `alreadyRefunded`에 넘겨 `Map`에서 마지막 줄만 남았기 때문이다. 테스트가 sku별 누적 수량을 넘기도록 고쳤다(커밋 01dcaa4). `npm test` → 22개 통과, 0개 실패. 재현 절차는 바꾸지 않았다(재현 코드 `refund.js`는 건드리지 않음).

## 반영하지 않은 지적
- 2번 (사람이 반영하지 않기로 함. 재현 절차가 쓰는 refund.js를 가독성만으로 건드리지 않음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(examples/O-1077.json, examples/R-0311.json)가 더 이상 실패하지 않는다: R-0311의 회수 포인트가 132P다 | 통과 | fix.md의 재현 명령을 다시 실행: `pointsRecovered` 132, `refundAmount` 13130. 수정 전 코드로 되돌리면 재현 테스트가 실패(131)하는 것도 확인함(이 Work는 재현됨) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 22, pass 22, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff b454f0f -- test/`: 기존 테스트 줄 변경 없음, 추가만 있음(import 한 줄, 테스트 2개) |
| 같은 주문을 여러 번 나눠 부분 환불한 회수 포인트 합계가 저장된 적립액(`points.earned`)을 넘지 않는 테스트가 있고 통과한다 | 통과 | test/refund.test.js '여러 번 나눠 부분 환불해도…' 4단계 환불, 합계 ≤ 403 및 = 344 확인, 통과. 수정 전 코드에서는 이 테스트가 실패함(단, 정확값 단언 때문이며 상한 단언만으로는 수정 전에도 통과) |
| 부분 환불 전후로 `refundAmount`와 `src/format/`의 영수증 출력이 바뀌지 않는다 | 통과 | `git diff b454f0f -- src/format` 출력 없음. refund.js 변경은 `pointsRecovered`뿐이고 `refundAmount: refundGoods`는 그대로. R-0311 refundAmount 13130(테스트로 고정) |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 기존 테스트는 그대로이고 테스트 2개와 파일 읽기 import만 추가했다. 리뷰 반영으로 다회 환불 테스트는 더 엄격해졌다(정확값 단언).

## 남은 위험
- `remainingEarn`은 earn.js와 별개로 같은 적립 규정(1% 버림)을 한 번 더 구현한다. 앞 Work(w-20261004-001, 머지 대기)에서 `earnBase`/`earnOn`이 머지되면 그쪽으로 합쳐야 하고, 머지 때 refund.js 충돌 가능성이 있다.
- 테스트에서 `alreadyRefunded`를 중복 sku로 넘기면 오류 없이 잘못 계산된다(코드는 입력을 검증하지 않음). 이번 변경 범위 밖이라 지식으로만 남겼다.
- 정산팀 계산 방식은 O-1077/R-0311 한 건으로만 대조했다.
