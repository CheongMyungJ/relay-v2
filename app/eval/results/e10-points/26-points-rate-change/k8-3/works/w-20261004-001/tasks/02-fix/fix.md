## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`, `node src/cli.js examples/G-0213.json`
- 결과: 재현됨
- 기대: O-1042 237P (23,770 × 1% 버림), G-0213 218P (21,860 × 1% 버림)
- 실제: O-1042 268P, G-0213 249P

## 원인
- 원인: `earnPoints`와 `giftPoints`가 배송비가 포함된 `amounts.total`에 반올림(`percentOf`)을 적용해 적립 기준과 달랐다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`(수정 전). O-1042 total 26,770 → 268P. 수정 후 기준 금액 23,770 → 237P, G-0213 21,860 → 218P. 수정 전 소스로 되돌려 새 테스트 4개가 실패함을 확인.
- 사람 추정 판정: 없음
- 기각한 가설: 배송비 제외 + 반올림 — O-1042가 238P가 되어 237P와 맞지 않음(intake에서 기각)

## 변경 요약
- src/points/earn.js — `earnBase`(상품 − 쿠폰 − 사용 포인트) 추가, 적립은 이 금액의 적립률% 버림
- src/gift/gift-points.js — `earnPoints`를 호출해 일반 주문과 같은 기준 사용
- src/money.js — 버림용 `percentOfFloor` 추가 (`percentOf`는 환불에서 쓰므로 그대로)
- test/earn.test.js — 새 테스트 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/earn.test.js (4개: O-1042, 버림, 배송비 제외, G-0213)
- 수정 전: 실패 (`node --test test/earn.test.js` → pass 0 / fail 4)
- 수정 후: 통과 (pass 4 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0 실패
- 실패 항목: 없음
