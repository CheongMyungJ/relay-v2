## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`
- 결과: 재현됨
- 기대: 적립 예정 237P
- 실제: 268P

## 원인
- 원인: `earnPoints`가 배송비가 포함된 결제 금액(`amounts.total`)의 1%를 반올림해 계산했다. 적립 안내 기준은 배송비를 뺀 금액이고 원 단위 버림이다.
- 근거: `src/points/earn.js`는 `amounts.total`(26,770원)을 썼고 이것이 268P와 맞는다. 배송비를 빼면 23,770원이고 1%는 237.7이다. 배송비만 빼고 반올림하면 238P가 나와 237P와 맞지 않았다(실험). 버림으로 바꾸자 237P가 나왔다. 배송비가 0인 주문(테스트의 500P)은 결과가 같다.
- 사람 추정 판정: 없음
- 기각한 가설: 배송비만 빼는 것으로 충분하다 — 반올림이 남아 238P가 나옴

## 변경 요약
- src/points/earn.js — 적립 기준을 `total - shipping`으로 바꾸고 원 단위 버림으로 계산한다. 공용 `percentOf`는 선물하기 적립도 쓰므로 건드리지 않았다.
- test/order.test.js — O-1042 입력으로 `points.earned`가 237인지 확인하는 테스트 추가 (기존 테스트는 바꾸지 않음)

## 재현 테스트
- 위치: test/order.test.js '적립 포인트는 배송비를 뺀 결제 금액을 기준으로 한다 (O-1042)'
- 수정 전: 실패 (`node --test test/order.test.js` — expected 237, actual 268)
- 수정 후: 통과 (`npm test` — pass 21, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 21개 통과, 0개 실패
- 실패 항목: 없음
