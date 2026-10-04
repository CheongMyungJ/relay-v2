## 리뷰 지적
없음

(확인한 것: 원인(반올림한 환불 상품금액 × 율, 쿠폰·사용 포인트 미반영)을 `src/orders/refund.js`에서 규칙식으로 직접 고쳤고 증상만 가린 것이 아니다. `refundAmount`, `cancelOrder`, `src/format/`, `points.earned`는 건드리지 않았다. `alreadyRefunded`는 `refundedBefore`로 환불 전 기준액에서 빠진다. 남은 금액 < 쿠폰+사용 포인트면 앞서 예외가 나므로 기준액은 음수가 되지 않는다.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (O-1077/R-0311의 `pointsRecovered`가 132) | 통과 | `createRefund`에 `examples/O-1077.json`, `examples/R-0311.json`을 넣어 직접 실행: `refundAmount` 13130, `pointsRecovered` 132. 재현 테스트도 통과. |
| `npm test`가 통과한다 | 통과 | `npm test` → 22개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 90125154 -- test/`는 `test/refund.test.js`에 추가만 있고(+27줄) 삭제·수정한 줄이 없다. |
| 부분 환불 회수 포인트가 "환불 전 기준액 적립 − 환불 후 기준액 적립"과 같다는 테스트가 있다 | 통과 | `test/refund.test.js`의 O-1077/R-0311 테스트(132)와 `alreadyRefunded` 테스트(300P−200P=100). 두 테스트 모두 수정 전 코드에서는 실패한다(fix.md). |
| 같은 입력에서 `refundAmount`와 영수증 출력이 수정 전과 같다 | 통과 | `node src/cli.js examples/R-0311.json --order examples/O-1077.json`을 기준 커밋(`git archive`)과 비교: 차이는 `포인트 회수` 줄 -131P → -132P뿐이다. 환불 금액 13,130원과 형식은 같다. `src/format/`은 변경 없음. 회수 포인트 값이 바뀌는 것은 수정 목적이다. |
| 이미 적립된 `points.earned`와 `alreadyRefunded`로 처리된 환불 수량은 다시 계산되지 않는다 | 통과 | `createRefund`는 `points.earned`를 읽지 않고, `cancelOrder`(`points.earned` 사용)는 변경 없음. `alreadyRefunded` 수량은 기존 검증과 `refundedBefore` 계산에만 쓰이며, 해당 테스트가 통과한다. |

## 테스트 파일 변경
- test/refund.test.js — 약화 아님 — 테스트 2개를 추가했을 뿐 기존 테스트와 단언은 그대로다.

## 남은 위험
- 앞 Work(w-20261004-001)가 머지되면 `src/money.js`의 `floorPercentOf`가 중복·충돌할 수 있다. 머지 때 한쪽으로 합쳐야 한다.
- `src/points/earn.js`, `src/gift/gift-points.js`는 아직 반올림 결제금액 기준이다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
- `pointsRecovered` 줄이 길다(약 120자). 동작에는 영향 없는 가독성 문제라 지적으로 올리지 않았다.
