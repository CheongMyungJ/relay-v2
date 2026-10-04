## 재현
- 재현 절차: 저장소 루트에서 `createGiftOrder(examples/G-0213.json)`과 같은 입력의 `createOrder`(번호만 O-9999)를 만들어 `points.earned`를 비교한다. 재현 테스트 `npm test`의 `선물하기 적립은 일반 주문과 같다 ... (G-0213)`로도 확인된다.
- 결과: 재현됨
- 기대: 218P (결제 24,860 − 배송비 3,000 = 21,860원의 1%, 버림)
- 실제: 선물 주문 249P (일반 주문은 218P)

## 원인
- 원인: `createGiftOrder`가 적립을 `giftPoints`(배송비를 포함한 total에 `percentOf` 반올림)로 계산해서, 일반 주문의 `earnPoints`(배송비 제외, 버림)와 기준이 다르다.
- 근거: `src/gift/gift-order.js:36`이 `giftPoints(order)`를 호출하고, `src/gift/gift-points.js`는 `percentOf(total, 1)`이다(24,860 → 248.6 → 249). 배송비가 0이고 정수 P로 떨어지는 주문(기존 테스트 30,000원 → 300P)은 두 방식이 같아 재현되지 않는다. 수정 뒤 249 → 218로 바뀌는 것을 실험으로 확인했다.
- 사람 추정 판정: "포인트 계산이 `src/gift/gift-points.js`에 있다" — 맞음(계산식은 거기에 있다). 다만 그 파일은 수정 금지라 호출하는 쪽(`gift-order.js`)을 고쳤다.
- 기각한 가설: gift-points.js 직접 수정 — 팀 규칙(`docs/knowledge/gift/gift-points-hands-off.md`)으로 금지, 사람이 유지 확인. `percentOf` 변경 — 같은 규칙과 비목표로 금지.

## 변경 요약
- `src/gift/gift-order.js` — 적립 계산을 `giftPoints`에서 `earnPoints`(`src/points/earn.js`)로 바꾸고 주석을 맞췄다. 주문 생성 시 한 번만 계산하므로 저장된 값을 다시 계산하는 코드는 없다.
- `test/gift.test.js` — G-0213 재현 테스트 추가(기존 테스트는 바꾸지 않음).

## 재현 테스트
- 위치: `test/gift.test.js` 마지막 테스트
- 수정 전: 실패 (`npm test` → expected 218, actual 249, fail 1)
- 수정 후: 통과 (`npm test` → pass 24, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패
- 실패 항목: 없음
