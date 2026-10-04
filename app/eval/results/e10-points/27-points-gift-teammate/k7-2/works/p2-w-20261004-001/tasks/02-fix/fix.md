## 재현
- 재현 절차: `node -e "import('./src/gift/gift-order.js').then(async m=>{const fs=await import('fs');console.log(m.createGiftOrder(JSON.parse(fs.readFileSync('examples/G-0213.json'))).points)})"`
- 결과: 재현됨
- 기대: earned 218
- 실제: earned 249 (amounts.total 24,860 = 상품 24,860 - 쿠폰 2,000 - 포인트 1,000 + 배송비 3,000)

## 원인
- 원인: `giftPoints`가 배송비를 포함한 `amounts.total`을 `percentOf`(반올림)로 계산해, 일반 주문(`earnPoints`: 배송비 제외, 버림)과 기준이 달랐다.
- 근거: `src/gift/gift-points.js:5` 수정 전 코드. 24,860의 1% = 248.6 → 반올림 249. 수정 뒤 21,860의 1% 버림 = 218. 수정 전후로 재현 테스트 실패/통과를 실험으로 확인했다. 배송비 없는 주문은 두 방식이 같은 값이라 기존 테스트가 잡지 못했다.
- 사람 추정 판정: 요청이 `src/gift/gift-points.js`를 보라고 함 — 맞음 (원인이 그 파일 5줄). 다른 팀 합의 여부는 판단 불가 (코드와 git 이력에 근거 없음)
- 기각한 가설: `amounts` 계산 오류 — 기각. 금액은 일반 주문과 같게 계산되고 선물 쪽 amounts는 바꾸지 않아야 한다.

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints(order)`를 호출하게 했다. `percentOf`, `gift-order.js`, `earn.js`는 그대로다.
- test/gift.test.js — 배송비 있는 G-0213과 배송비 없고 소수 버림이 생기는 선물 주문이 `earnPoints`와 같다는 테스트 2개 추가 (기존 테스트는 그대로)

## 재현 테스트
- 위치: test/gift.test.js 마지막 두 테스트
- 수정 전: 실패 — `npm test` → 24 pass, 2 fail (249≠218, 320≠319)
- 수정 후: 통과 — `npm test` → 26 pass, 0 fail

## 테스트 실행
- 명령: `npm test`
- 결과: 26 pass, 0 fail
- 실패 항목: 없음
