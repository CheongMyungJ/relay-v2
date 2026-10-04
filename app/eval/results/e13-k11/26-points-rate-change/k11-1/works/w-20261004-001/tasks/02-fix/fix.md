## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P (기준 23,770원 × 1%, 버림)
- 실제: 268P (결제 금액 26,770원 × 1%, 반올림)

## 원인
- 원인: `earnPoints`와 `giftPoints`가 배송비·사용 포인트가 반영된 `amounts.total`(배송비 포함)에 `percentOf`(반올림)를 적용했다. 기준 금액과 반올림 규칙이 둘 다 틀렸다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`(수정 전). O-1042는 total 26,770 → 268P. 수정 후 기준 23,770 → 237P. 수정 전 코드에서 새 테스트 4개가 모두 실패하고 수정 후 통과함.
- 사람 추정 판정: "코드는 `src/points/earn.js`" — 맞음, 다만 선물하기 경로 `src/gift/gift-points.js`에 같은 식이 따로 있어 함께 고쳐야 했음.
- 기각한 가설: 없음

## 변경 요약
- src/money.js — 원 단위 버림 `percentOfFloor` 추가(기존 `percentOf`는 환불에서 쓰므로 유지)
- src/points/earn.js — 적립 기준 `earnBase`(상품 − 쿠폰 − 사용 포인트)와 버림으로 계산
- src/gift/gift-points.js — `earnPoints`에 위임해 일반 주문과 같은 규칙 사용
- test/earn.test.js — 재현 테스트 추가(기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/earn.test.js (O-1042, 배송비 유/무, 버림, 선물하기)
- 수정 전: 실패 (`node --test test/earn.test.js` → pass 0, fail 4)
- 수정 후: 통과 (같은 명령 → pass 4, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패. `node src/cli.js examples/O-1042.json` → 237P
- 실패 항목: 없음
