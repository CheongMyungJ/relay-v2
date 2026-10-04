# 포인트 적립을 (상품-쿠폰-사용 포인트)의 1% 버림으로 맞춤 (일반·선물·환불 회수)

## 요약
적립 예정 포인트가 고객센터 안내보다 많게 나오던 문제를 고쳤다. 적립 = (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림. O-1042는 268P → 237P, G-0213은 218P.

## 원인
적립 기준이 배송비를 포함한 `amounts.total`이었고 `percentOf`가 반올림이라 끝수를 올렸다. 선물 적립과 부분 환불 회수도 같은 방식이었고, 환불은 쿠폰·사용 포인트가 반영되지 않았다.

## 변경
- `src/points/earn.js`: `earnBase`/`earnFromAmounts` 추가, 공통 기준으로 사용
- `src/money.js`: 버림 `floorPercentOf` 추가
- `src/gift/gift-points.js`: `earnPoints` 재사용
- `src/orders/refund.js`: 부분 환불 회수 = 환불 전 적립분 − 환불 뒤 적립분
- `docs/knowledge/points/`: 적립 기준과 저장값 비재계산 규칙 기록
- 저장된 `points.earned` 재계산과 `src/format/` 변경 없음

## 테스트
- `npm test`: 25개 통과
- 새 `test/earn.test.js`(O-1042, 배송비, 끝수 버림, G-0213, 부분 환불)는 기준 커밋에서 5개 실패
- 주의: 옛 기준으로 저장된 주문의 부분 환불은 현재 규칙으로 계산해 저장된 earned와 어긋날 수 있다
