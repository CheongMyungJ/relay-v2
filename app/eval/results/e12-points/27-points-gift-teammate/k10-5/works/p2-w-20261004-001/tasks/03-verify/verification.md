## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (G-0213의 적립 예정 포인트가 218P) | 통과 | `examples/G-0213.json`을 `createGiftOrder`에 넣어 직접 실행: `points.earned` = 218 (수정 전 249) |
| `npm test`가 통과한다 | 통과 | `npm test`: tests 22, pass 22, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff c068484 -- test`는 `test/gift.test.js`에 테스트 1개 추가뿐, 기존 줄 변경·삭제 없음 |
| 선물하기 적립 계산이 `goods − coupon − pointsUsed`의 1%를 내림한 값이다 | 통과 | `giftPoints`가 `earnPoints`(`Math.floor((goods − coupon − pointsUsed) × 1% )`)를 호출. G-0213 = 218, 배송비 3,000 제외 확인 |
| 선물 메시지 카드, 받는 사람 정보, `src/format/`의 출력은 변경 전과 같다 | 통과 | 기준 커밋 이후 코드 변경은 `src/gift/gift-points.js`와 `test/gift.test.js`뿐. `gift-order.js`, `src/format/`은 diff 없음 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — G-0213 재현 테스트 1개만 추가했고 기존 테스트는 그대로다. 수정 전 249로 실패하는 것을 fix 단계에서 확인했다.

## 남은 위험
- `src/orders/refund.js:34` 부분 환불 회수는 `percentOf` 반올림이라 새 적립과 1P 어긋날 수 있다 (비목표).
- 근거가 고객센터 계산 사례(O-1042, G-0213) 두 건뿐이다.
