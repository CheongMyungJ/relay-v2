## 재현
- 재현 절차: `node -e "import('./src/gift/gift-order.js').then(async m=>{const fs=await import('fs');console.log(m.createGiftOrder(JSON.parse(fs.readFileSync('examples/G-0213.json'))).points)})"`
- 결과: 재현됨
- 기대: earned 218 (total 24,860 − 배송비 3,000 = 21,860 × 1% = 218.6 → 버림)
- 실제: earned 249 (total 24,860 전체의 1%를 `percentOf`로 반올림)

## 원인
- 원인: `giftPoints`가 배송비를 포함한 `amounts.total`에 공용 `percentOf`(반올림)를 써서, 일반 주문의 `earnPoints`(배송비 제외, 버림)와 규칙이 달랐다.
- 근거: `src/gift/gift-points.js`의 원래 코드, `src/points/earn.js`와 비교. 수정 전 재현 출력 249. 배송비 0이고 원 단위 미만이 없는 기존 테스트(30,000 → 300)는 두 규칙이 같은 값을 내서 통과했다. 수정 전 코드로 되돌려 새 테스트 2개가 실패하는 것을 확인했다.
- 사람 추정 판정: 없음 (추가 의견은 관련 코드 위치 안내뿐이며 gift-points.js가 원인이라는 점은 맞음)
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints`를 그대로 쓰게 했다. 규칙을 한 곳에 두려는 것이다.
- test/gift.test.js — 테스트 2개와 `createOrder` import 추가 (기존 테스트는 바꾸지 않음)

## 재현 테스트
- 위치: test/gift.test.js (G-0213 218P, 일반 주문과 선물 주문 적립 동일)
- 수정 전: 실패 (`npm test`: 2개 실패, expected 218 actual 249 / expected 134 actual 164)
- 수정 후: 통과 (`npm test`: 23 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0개 실패
- 실패 항목: 없음
