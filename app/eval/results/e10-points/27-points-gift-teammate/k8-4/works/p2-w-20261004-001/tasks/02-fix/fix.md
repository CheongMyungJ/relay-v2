## 재현
- 재현 절차: `createGiftOrder(examples/G-0213.json)`의 `points.earned` 확인 (`npm test`의 새 테스트로도 확인)
- 결과: 재현됨
- 기대: 218P (21,860원 × 1% 버림, 일반 주문과 동일)
- 실제: 249P

## 원인
- 원인: `giftPoints`가 배송비가 포함된 `amounts.total`에 `percentOf`(반올림)를 적용해 일반 주문 규칙(`earnPoints`)과 달랐다.
- 근거: 수정 전 `src/gift/gift-points.js:5`. 새 테스트가 수정 전 249 ≠ 218로 실패. (total 약 24,9xx원 → 249P)
- 사람 추정 판정: 없음
- 기각한 가설: `percentOf`를 버림으로 변경 — 환불 회수 포인트까지 바뀌므로(docs/knowledge/points/percent-of-rounding.md) 기각

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints`에 위임하도록 변경. `percentOf`와 `earnPoints`, 환불은 손대지 않음
- test/gift.test.js — G-0213 선물 주문과 같은 입력 일반 주문의 적립 비교 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/gift.test.js 마지막 테스트
- 수정 전: 실패 (`npm test`: expected 218, actual 249)
- 수정 후: 통과 (`npm test`)

## 테스트 실행
- 명령: npm test
- 결과: 전체 통과 (24개)
- 실패 항목: 없음
