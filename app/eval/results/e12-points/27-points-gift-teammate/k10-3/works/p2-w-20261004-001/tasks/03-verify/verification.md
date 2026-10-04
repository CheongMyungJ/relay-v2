## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트 계산)가 더 이상 실패하지 않는다. 결과가 249P가 아니라 218P다 | 통과 | fix.md의 재현 명령을 직접 실행: `{ used: 1000, earned: 218 }`. 기준 커밋의 `gift-points.js`로 되돌리면 새 테스트 2건이 실패(pass 3 / fail 2)해 실제로 재현되던 Work임 |
| `npm test`가 통과한다 | 통과 | `npm test`: 24개 중 24 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 23579ce -- test/`: `test/gift.test.js`에 import 2줄과 테스트 2개를 추가만 했고 기존 단언은 그대로 |
| G-0213의 적립 예정 포인트가 218P임을 확인하는 테스트가 있다 | 통과 | `test/gift.test.js` "G-0213의 적립 예정 포인트는 218P ..." (examples/G-0213.json로 `points.earned === 218`) |
| 같은 상품·쿠폰·사용 포인트로 만든 일반 주문과 선물하기 주문의 적립 포인트가 같다 | 통과 | `test/gift.test.js` 두 번째 추가 테스트가 같은 입력으로 `createOrder`와 `createGiftOrder`의 `points.earned`를 비교하며 통과. `giftPoints`가 `earnPoints`에 위임해 구조적으로도 같음 |
| `src/format/` 아래 파일, 선물 메시지 카드와 받는 사람 검증 코드는 바뀌지 않는다 | 통과 | `git diff 23579ce --stat`: 바뀐 파일은 `src/gift/gift-points.js`, `test/gift.test.js`뿐. `gift-order.js`의 검증 코드 무변경 |
| 이미 저장된 `points.earned` 값을 다시 계산하는 코드가 추가되지 않는다 | 통과 | 변경은 `giftPoints`가 새 주문 생성 시 `earnPoints`를 부르게 한 것뿐이며 저장된 값을 읽어 재계산하는 코드는 없음 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 테스트 2개와 import만 추가했고 기존 테스트·단언은 바뀌지 않음

## 남은 위험
- 배송비 무료 등 다른 선물하기 주문의 고객센터 값은 확인하지 못했다(같은 기준이라고 가정).
- 이미 저장된 선물하기 주문의 `points.earned`에는 옛 값(반올림, 배송비 포함)이 남아 있을 수 있다. 비목표라 재계산하지 않았다.
