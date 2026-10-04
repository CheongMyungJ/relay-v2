## 재현
- 재현 절차: `node src/cli.js examples/G-0213.json` 마지막 줄 확인
- 결과: 재현됨
- 기대: 적립 예정 218P
- 실제: 적립 예정 249P

## 원인
- 원인: `giftPoints`가 일반 주문의 `earnPoints`를 쓰지 않고 배송비 포함 `amounts.total`에 `percentOf`(반올림)를 적용했다.
- 근거: `src/gift/gift-points.js:6`. G-0213은 total 24,860(배송비 3,000 포함, 상품 24,860 − 쿠폰 2,000 − 포인트 1,000 + 배송비 3,000) × 1% = 248.6 → 249. 규칙대로면 (24,860 − 2,000 − 1,000) × 1% = 218.6 → 218. 수정 후 실행 결과 218P. 일반 주문 경로(`earnPoints`)는 이미 규칙대로라 영향 없음.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints(order)`를 호출하게 변경(일반 주문과 같은 규칙, 코드 중복 제거)
- test/gift.test.js — G-0213 재현 테스트 추가(기존 테스트는 변경 없음)

## 재현 테스트
- 위치: test/gift.test.js 「선물하기 적립은 배송비를 빼고 소수점을 버린다 (G-0213 = 218P)」
- 수정 전: 실패 (`npm test` — expected 218, actual 249)
- 수정 후: 통과 (`npm test` — 25 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 25개 통과, 0개 실패
- 실패 항목: 없음
