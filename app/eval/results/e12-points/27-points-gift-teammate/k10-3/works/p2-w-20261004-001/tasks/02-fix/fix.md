## 재현
- 재현 절차: 워크트리에서 `node -e "import('./src/gift/gift-order.js').then(m=>console.log(m.createGiftOrder(JSON.parse(require('fs').readFileSync('examples/G-0213.json'))).points))"`
- 결과: 재현됨
- 기대: `earned` 218
- 실제: `earned` 249 (amounts: total 24,860, shipping 3,000)

## 원인
- 원인: `giftPoints`가 배송비가 포함된 `amounts.total` 전체에 `percentOf`(반올림)를 써서, 일반 주문의 기준(배송비 제외, 1P 미만 버림)과 달랐다.
- 근거: `src/gift/gift-points.js:6`이 `percentOf(order.amounts.total, 1)`이다. 24,860×1% = 248.6 → 반올림 249. 일반 주문 `src/points/earn.js`는 (24,860−3,000)×1% = 218.6 → 버림 218. 기존 `test/gift.test.js`는 배송비 0·딱 떨어지는 금액(300P)만 써서 차이가 드러나지 않았다(배송비 0이고 정수 포인트일 때만 두 방식이 같다). 수정 뒤 218이 나오는 것을 실험으로 확인했다.
- 사람 추정 판정: 없음 (사람은 규칙을 모른다고 했고 218P라는 값만 줌. 이 값이 일반 주문 규칙으로 나오는 것을 확인함)
- 기각한 가설: 없음

## 변경 요약
- `src/gift/gift-points.js` — `giftPoints`가 `earnPoints`를 그대로 쓰게 바꿔 기준을 한 곳으로 모음. `src/points/earn.js`는 그대로 둠.
- `test/gift.test.js` — 테스트 2개 추가(G-0213 = 218P, 같은 입력의 일반 주문과 선물 주문 적립 동일). 기존 테스트는 바꾸지 않음.

## 재현 테스트
- 위치: `test/gift.test.js` 4, 5번째 테스트
- 수정 전: 실패 (`node --test test/gift.test.js` — expected 218, actual 249, 2건 fail)
- 수정 후: 통과 (`npm test` — 24개 중 24 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 24 통과, 0 실패
- 실패 항목: 없음
