## 재현
- 재현 절차: `node -e "import('./src/gift/gift-order.js').then(m=>{const o=m.createGiftOrder(JSON.parse(require('fs').readFileSync('examples/G-0213.json')));console.log(o.points)})"`
- 결과: 재현됨
- 기대: earned 218
- 실제: earned 249 (amounts.total 24,860 = 배송비 3,000 포함 기준, 반올림)

## 원인
- 원인: `giftPoints`가 배송비를 뺀 금액이 아니라 `order.amounts.total`에 `percentOf`(반올림)를 적용한다. 일반 주문의 `earnPoints`와 기준이 달랐다.
- 근거: src/gift/gift-points.js:5 수정 전 코드. 수정 후 같은 입력이 218로 나오고 재현 테스트가 수정 전 249로 실패했다.
- 사람 추정 판정: gift-points.js 쪽 문제 — 맞음 — 수정이 이 파일 안에서 끝나고 재현 결과가 해소됨
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `earnPoints`(일반 주문 계산)를 그대로 호출하도록 변경. `percentOf`·earn.js는 건드리지 않음. 두 계산이 어긋나지 않도록 코드를 공유함
- test/gift.test.js — G-0213 재현 테스트 추가 (기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/gift.test.js '선물하기 적립은 배송비를 빼고 원 단위로 버린다 (G-0213 = 218P)'
- 수정 전: 실패 (`npm test` — expected 218, actual 249)
- 수정 후: 통과 (`npm test` — 23 pass, 0 fail)

## 테스트 실행
- 명령: npm test
- 결과: 23 통과, 0 실패
- 실패 항목: 없음
