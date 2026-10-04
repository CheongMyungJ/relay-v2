## 재현
- 재현 절차: `createGiftOrder(JSON.parse(readFileSync('examples/G-0213.json')))`의 `points.earned` 확인 (재현 테스트 `node --test test/gift.test.js`)
- 결과: 재현됨
- 기대: 218P
- 실제: 249P

## 원인
- 원인: `giftPoints`가 배송비가 포함된 `amounts.total`에 `percentOf`(반올림)를 적용해, 배송비를 빼고 버림하는 일반 주문 `earnPoints`와 계산이 달랐다.
- 근거: G-0213은 상품 24,860 − 쿠폰 2,000 = 22,860 < 30,000이라 배송비 3,000이 붙고, total = 24,860(포인트 사용 1,000 차감 후). 현재 코드: 24,860 × 1% = 248.6 → 반올림 249. 일반 방식: (24,860 − 3,000) × 1% = 218.6 → 버림 218. `src/gift/gift-points.js`, `src/points/earn.js`. 수정 후 218이 나옴을 테스트로 확인. 배송비가 0인 주문(기존 테스트 30000원)은 두 방식이 같아 드러나지 않았다.
- 사람 추정 판정: 요청이 지목한 `src/gift/gift-points.js` — 맞음 (원인이 이 파일)
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — 자체 계산을 없애고 `earnPoints`를 호출해 일반 주문과 같은 기준(배송비 제외, 버림)으로 계산
- test/gift.test.js — 테스트 2개 추가 (기존 테스트는 바꾸지 않음)

## 재현 테스트
- 위치: test/gift.test.js (G-0213 218P, 같은 금액 일반 주문과 동일)
- 수정 전: 실패 (`node --test test/gift.test.js` — expected 218 actual 249, expected 159 actual 189)
- 수정 후: 통과 (같은 명령, 전체 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패
- 실패 항목: 없음
