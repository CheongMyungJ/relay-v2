## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P (결제 금액 26,770원의 1%를 반올림)

## 원인
- 원인: 적립 기준이 결제 금액(`amounts.total`, 배송비 포함)이고 반올림(`percentOf`)을 썼다. 적립 안내 값(237P)은 쿠폰·사용 포인트를 뺀 상품 금액(배송비 제외) 23,770원의 1%를 내림한 값이다.
- 근거: `src/points/earn.js`와 `src/gift/gift-points.js`가 `percentOf(order.amounts.total, ...)`를 썼다. 28,270-3,000-1,500=23,770 → 237.7. 기준만 고치면 238P가 나와(실험함) 내림이 필요함을 확인했다. 배송비가 있는 주문일수록 더 많이 나온다.
- 사람 추정 판정: 요청의 "earn.js 확인" — 맞음. 원인 위치가 `earn.js`(와 같은 식을 쓴 `gift-points.js`)에 있다.
- 기각한 가설: 적립률 값 문제 — 비목표이고 1%는 237P와 맞는다. 결제 금액에서 배송비만 빼는 안(268→…) — 사용 포인트도 빼야 23,770이 되어 237P와 맞지 않는다.

## 변경 요약
- src/points/earn.js — `earnBase`(상품 금액-쿠폰-사용 포인트) 추가, 적립은 내림으로 계산
- src/gift/gift-points.js — 일반 주문과 같은 `earnPoints`를 쓰게 함
- test/earn.test.js — 새 테스트

## 재현 테스트
- 위치: test/earn.test.js
- 수정 전: 실패 (`npm test`: 5개 중 O-1042 237P, 배송비 제외, 선물하기, 내림 테스트 4건 실패)
- 수정 후: 통과 (`npm test`: 26개 통과, 실패 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 26 통과, 0 실패. `node src/cli.js examples/O-1042.json` → 237P
- 실패 항목: 없음
