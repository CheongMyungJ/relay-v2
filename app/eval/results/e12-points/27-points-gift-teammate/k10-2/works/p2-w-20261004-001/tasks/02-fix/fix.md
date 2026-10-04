## 재현
- 재현 절차: `node -e "import('./src/gift/gift-order.js').then(m=>{const o=m.createGiftOrder(JSON.parse(require('fs').readFileSync('examples/G-0213.json')));console.log(o.amounts,o.points)})"`
- 결과: 재현됨
- 기대: 218P (floor((24,860 − 3,000) × 1%) = floor(218.6))
- 실제: 249P (24,860 × 1% = 248.6 → 반올림 249)

## 원인
- 원인: `giftPoints`가 배송비를 뺀 금액이 아니라 `amounts.total` 전체를 공용 `percentOf`(반올림)로 계산했다. 일반 주문의 `earnPoints`와 규칙이 달랐다.
- 근거: `src/gift/gift-points.js:5`(수정 전). G-0213은 amounts.shipping 3,000, total 24,860으로 출력되어 249와 218이 모두 설명된다. 배송비가 0이고 소수점이 .5 미만이면 두 계산이 같아 기존 테스트(30,000원 → 300P)는 통과했다. 수정 전에 새 테스트 2개가 실패했고 수정 뒤 통과했다.
- 사람 추정 판정: "`src/gift/gift-points.js`를 보라" — 맞음 — 원인이 그 파일 5줄에 있었다.
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints`(src/points/earn.js)를 호출하게 바꿨다. 규칙을 한 곳에 두어 다시 어긋나지 않게 한다. `percentOf`는 건드리지 않았다.
- test/gift.test.js — G-0213(218P)과 배송비 0원 버림 경계(35,050원 → 350P) 테스트를 추가했다. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: test/gift.test.js (테스트 2개 추가)
- 수정 전: 실패 (`npm test` → pass 22, fail 2: G-0213 249≠218, 버림 경계 351≠350)
- 수정 후: 통과 (`npm test` → pass 24, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패
- 실패 항목: 없음
