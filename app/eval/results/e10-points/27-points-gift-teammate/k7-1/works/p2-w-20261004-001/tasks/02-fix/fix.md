## 재현
- 재현 절차: `node src/cli.js examples/G-0213.json`
- 결과: 재현됨
- 기대: 적립 예정 218P (기준 24,860 − 2,000 − 1,000 = 21,860원의 1% 버림)
- 실제: 249P

## 원인
- 원인: `giftPoints`가 배송비 3,000원이 포함된 `amounts.total`(24,860)에 반올림 `percentOf`를 적용해 적립 기준과 달랐다.
- 근거: `src/gift/gift-points.js`의 `percentOf(order.amounts.total, ...)`. amounts는 goods 24860, coupon 2000, shipping 3000, pointsUsed 1000, total 24860. 일반 주문용 `earnPoints`로 바꾸자 218P가 나왔다.
- 사람 추정 판정: 고객센터 계산 기준 218P — 맞음 — 수정 후 코드가 218P를 낸다.
- 기각한 가설: 없음

## 변경 요약
- `src/gift/gift-points.js` — `earnPoints`를 재사용하도록 바꿔 일반 주문과 같은 기준(배송비 제외, 원 단위 버림)을 쓴다.
- `test/gift.test.js` — G-0213 재현 테스트를 추가했다(기존 테스트는 변경하지 않음).

## 재현 테스트
- 위치: `test/gift.test.js` "선물하기 적립은 일반 주문과 같은 기준(배송비 제외, 원 단위 버림)"
- 수정 전: 실패 (`npm test` — expected 218, actual 249)
- 수정 후: 통과 (`npm test` — 24 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 24개 통과, 0개 실패. 영수증은 G-0213에서 적립 예정 줄만 249P에서 218P로 바뀌었다.
- 실패 항목: 없음
