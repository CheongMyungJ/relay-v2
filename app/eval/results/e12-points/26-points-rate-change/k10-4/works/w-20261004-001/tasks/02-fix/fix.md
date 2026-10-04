## 재현
- 재현 절차: `node src/cli.js examples/O-1042.json`, `node src/cli.js examples/G-0213.json`, `node src/cli.js examples/R-0311.json --order examples/O-1077.json`
- 결과: 재현됨
- 기대: O-1042 적립 예정 237P, G-0213은 (24,860 − 2,000 − 1,000 = 21,860 → 218P)
- 실제: O-1042 268P, G-0213 249P. 모두 배송비를 포함한 결제 금액을 반올림한 값이다.

## 원인
- 원인: `earnPoints`와 `giftPoints`가 `amounts.total`(배송비 포함)에 `percentOf`(`Math.round`)를 적용했다. 환불 회수도 같은 `percentOf`를 써서 반올림했다.
- 근거: `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(수정 전). 수정 전 CLI 출력 268P/249P. 수정 후 237P/218P로 바뀌었다. 배송비가 0이면 total 기준과 새 기준 차이는 반올림뿐이라, 무료 배송 주문은 반올림이 갈리는 경우에만 어긋난다. 그래서 "조금씩 많게" 나온다.
- 사람 추정 판정: "다른 주문도 적립이 조금씩 많게 나오는 것 같다" — 맞음 — 같은 계산식을 쓰는 모든 주문에서 배송비 포함과 반올림 때문에 많게 나온다.
- 기각한 가설: `percentOf`의 반올림만 바꾸면 된다 — 기각. 배송비가 포함된 `total`이 기준이어서 O-1042는 267P(버림만)로 여전히 규정(237P)과 다르다.

## 변경 요약
- `src/money.js` — 버림 버전 `percentOfFloor` 추가. `percentOf`는 그대로 둔다(다른 곳에서 쓸 수 있어 영향 방지).
- `src/points/earn.js` — `earnBase`(상품 − 쿠폰 − 사용 포인트) 추가, 적립은 이 금액의 1% 버림.
- `src/gift/gift-points.js` — `earnPoints`에 위임해 같은 기준을 쓴다.
- `src/orders/refund.js` — 회수 포인트를 `percentOfFloor`로 버림. 기준은 환불 상품 금액 그대로(쿠폰·사용 포인트는 남은 주문에 둔다는 기존 설계 유지).

## 재현 테스트
- 위치: `test/points-earn.test.js` (새 파일)
- 수정 전: 실패 — 수정 전 src로 `node --test test/points-earn.test.js`: 5개 중 4개 실패(1, 3, 4, 5번), 통과 1(무료 배송은 반올림 차이가 없는 값이라 통과)
- 수정 후: 통과 — 5개 모두 통과
- 환불 테스트는 R-0311 값(13,130원 → 131P)과 한 개 환불(6,565원 → 65P)을 확인한다. 수정 전에는 66P라서 실패한다. 13,130원 케이스는 수정 전에도 131이어서 R-0311 결과는 달라지지 않는다.

## 테스트 실행
- 명령: `npm test`
- 결과: 25개 통과, 0개 실패 (기존 20 + 신규 5). 기존 테스트는 바꾸지 않았다. `src/format/` 변경 없음.
- 실패 항목: 없음
