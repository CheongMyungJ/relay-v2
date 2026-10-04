## 재현
- 재현 절차: `node src/cli.js examples/G-0213.json`
- 결과: 재현됨
- 기대: 적립 예정 218P (일반 규칙: (24,860 − 배송비 3,000) × 1% = 218.6 → 내림 218)
- 실제: 적립 예정 249P

## 원인
- 원인: `giftPoints`가 일반 주문의 `earnPoints`와 별도로 `percentOf(order.amounts.total, 1)`을 써서, 배송비를 빼지 않고 반올림한다. 커밋 5ff61ae는 `earn.js`만 고치고 이 복사본은 고치지 못했다.
- 근거: `src/gift/gift-points.js`(수정 전)는 `percentOf(total, rate)`이고 `src/money.js`의 percentOf는 `Math.round`다. 24,860 × 1% = 248.6 → 249로 실제 출력과 일치한다. 배송비가 0이고 소수점 .5 미만인 주문은 두 방식의 값이 같아서 기존 테스트(300P)는 통과했다. 수정 뒤 249 → 218로 바뀌었다(실험).
- 사람 추정 판정: 없음 (요청에 사람이 추정한 원인은 없다. 지목한 `gift-points.js`가 실제 원인 위치다)
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — 자체 계산을 없애고 `earnPoints(order)`에 맡겨, 선물하기와 일반 주문이 한 규칙을 쓰게 했다.
- test/gift.test.js — G-0213 조건의 선물 주문과 같은 조건의 일반 주문을 만들어 적립이 218P로 같은지 보는 테스트를 추가했다. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: test/gift.test.js '선물하기 적립은 일반 주문과 같은 규칙이다 (G-0213 …)'
- 수정 전: 실패 (`node --test test/gift.test.js` → expected 218, actual 249)
- 수정 후: 통과 (`npm test` → 23개 모두 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: tests 23, pass 23, fail 0
- 실패 항목: 없음
- 참고: G-0213 영수증 출력 전후 비교(diff)는 '적립 예정' 줄(249P → 218P)만 다르다. 메시지 카드, 받는 사람, `src/format/`은 바꾸지 않았다.
