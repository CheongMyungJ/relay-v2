## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P (기준 금액 23,770원)
- 실제: 268P (기준 금액 26,770원 = 결제 금액)

## 원인
- 원인: `earnPoints`가 `order.amounts.total`(배송비 포함, 사용 포인트 차감 후)에 반올림(`percentOf`)을 적용했다. 배송비 3,000원이 기준에 들어가고 소수점은 버리지 않고 반올림했다.
- 근거: `src/points/earn.js:6` 수정 전 코드. 계산: 26,770×1% = 267.7 → 268. 배송비가 없는 주문은 total이 기준 금액과 같아 차이가 없었고(기존 테스트 500P), 배송비가 있거나 소수점이 생기는 주문에서만 어긋난다. 수정 후 237P로 바뀌는 것을 실행해 확인했다.
- 사람 추정 판정: 요청에서 지목한 위치 `src/points/earn.js` — 맞음 — 원인이 그 파일에 있다.
- 기각한 가설: 없음

## 변경 요약
- src/points/earn.js — 기준 금액을 `goods - coupon - pointsUsed`로 하고 소수점을 버린다.
- src/money.js — `floorPercentOf` 추가. 기존 `percentOf`(반올림)는 선물하기가 쓰므로 그대로 둔다.
- test/earn.test.js — 새 테스트 파일(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/earn.test.js (3건: 배송비 제외, 소수점 버림, O-1042 237P)
- 수정 전: 실패 (`node --test test/earn.test.js` → pass 0, fail 3)
- 수정 후: 통과 (`npm test` → pass 23, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 23건 통과, 0건 실패
- 실패 항목: 없음
