## 재현
- 재현 절차: `node src/cli.js examples/G-0213.json` 실행 후 "적립 예정" 줄 확인
- 결과: 재현됨
- 기대: 218P (24,860 - 2,000 - 1,000 = 21,860원의 1%, 버림)
- 실제: 249P

## 원인
- 원인: `giftPoints`가 일반 주문의 `earnPoints`를 쓰지 않고 결제 금액(`amounts.total`, 배송비 포함·쿠폰/포인트 차감)에 `percentOf`(반올림)를 따로 적용했다. 그래서 배송비가 기준에 들어가고 반올림이 된다.
- 근거: 수정 전 `src/gift/gift-points.js:6`. G-0213은 total 24,860(배송비 3,000 포함)의 1% = 248.6 → 반올림 249P. 같은 입력의 일반 주문은 `earnPoints`(`src/points/earn.js`)로 218P. 배송비가 0이고 쿠폰·포인트가 없으면 두 식이 같아 기존 테스트(30,000원 → 300P)는 통과했다. 수정 후 218P, 영수증 diff는 적립 예정 줄뿐이다.
- 사람 추정 판정: `src/gift/gift-points.js`가 관련 코드 — 맞음 — 위 원인이 이 파일이다.
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — 별도 식을 없애고 `earnPoints(order)`에 위임. 규칙을 한 곳에서 관리하기 위해서다.
- test/gift.test.js — G-0213의 218P 테스트, 선물하기와 일반 주문의 적립 동일 테스트 추가 (기존 테스트는 그대로)

## 재현 테스트
- 위치: test/gift.test.js (테스트 11, 12)
- 수정 전: 실패 (`gift-points.js`를 되돌리고 `npm test` → 테스트 11, 12 not ok, fail 2)
- 수정 후: 통과 (`npm test` → pass 25, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 25개 통과, 0개 실패
- 실패 항목: 없음
