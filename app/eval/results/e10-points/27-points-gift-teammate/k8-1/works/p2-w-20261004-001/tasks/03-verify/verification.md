## 리뷰 지적
없음

(확인한 것: `giftPoints`가 `earnPoints`에 위임해 원인(배송비 포함·반올림)을 직접 고쳤다. `createGiftOrder`는 주문 생성 시점에 한 번 계산할 뿐 저장된 `points.earned`를 다시 계산하지 않는다. `giftPoints` export와 호출처(`gift-order.js`, `index.js`)는 그대로다. `src/format/` 변경 없음.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트 계산)가 더 이상 실패하지 않는다: 218P가 나온다 | 통과 | `node src/cli.js examples/G-0213.json` → 적립 예정 218P (fix.md의 수정 전 249P와 비교) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 23, pass 23, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff d82983c`에서 test/gift.test.js는 추가만 있고 삭제·수정된 기존 테스트 없음 |
| G-0213의 적립 예정 포인트가 일반 주문으로 같은 상품을 샀을 때와 같다 | 통과 | `giftPoints`가 `earnPoints`를 그대로 호출하고, 테스트가 `giftPoints(g) === earnPoints(g)`를 확인 |
| 선물하기 적립 계산에 대한 테스트가 추가되어 G-0213의 218P를 확인한다 | 통과 | test/gift.test.js의 새 테스트가 `points.earned === 218`을 단언, 통과 |
| `src/format/` 아래 파일과 선물 메시지·받는 사람 정보 처리가 바뀌지 않는다 | 통과 | `git diff d82983c --name-only -- src/format` 결과 없음. 변경 파일은 gift-points.js, gift.test.js와 docs/knowledge뿐 |
| 이미 저장된 `points.earned`를 다시 계산하는 코드가 생기지 않는다 | 통과 | diff에 재계산 코드 없음. 계산은 `createGiftOrder`의 생성 시점 1회뿐 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — G-0213 적립 테스트와 import만 추가. 기존 테스트는 그대로다. 수정 전 코드에서 249로 실패한다고 fix.md에 기록됨.

## 남은 위험
- `src/gift/gift-points.js`는 다른 팀과 공유하는 파일이다. 사람이 이번 수정을 허용했지만 다른 팀과의 합의는 확인되지 않았다.
- 다른 선물 주문도 배송비 제외·버림으로 적립이 줄어든다(배송비가 있는 주문).
- 부분 환불(`src/orders/refund.js`)의 포인트 회수 기준은 여전히 다르다(비목표).
