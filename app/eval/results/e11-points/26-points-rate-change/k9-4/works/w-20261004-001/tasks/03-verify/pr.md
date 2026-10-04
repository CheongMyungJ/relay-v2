# 적립 포인트를 상품 금액−쿠폰−사용 포인트 기준 1% 버림으로 계산한다

## 요약
적립 포인트가 배송비 포함 결제 금액을 반올림해 계산되어 안내보다 많게 나오던 문제를 고쳤다. O-1042는 268P → 237P.

## 원인
`earnPoints`/`giftPoints`가 `amounts.total`(배송비 포함)에 `percentOf`(반올림)를 썼고, 환불 회수도 쿠폰·사용 포인트를 빼지 않고 반올림했다.

## 변경
- `src/points/earn.js`: `earnBase`(상품−쿠폰−사용 포인트), `pointsOf`(1% 버림). `src/money.js`에 `floorPercentOf` 추가
- 선물하기 적립은 `earnPoints`를 그대로 사용
- 부분 환불 회수 = 환불 전 적립 − 환불 후 적립
- 저장된 `points.earned`와 `src/format/`은 변경 없음
- `docs/knowledge/`에 적립 규칙과 영수증 글자 고정 규칙 기록

## 테스트
- `npm test`: 28개 통과 (신규 8개: O-1042 237P, 배송비 제외, 버림, 선물하기, 환불 회수, 분할 환불, 저장값 유지)
- `node src/cli.js examples/O-1042.json` → 적립 예정 237P
