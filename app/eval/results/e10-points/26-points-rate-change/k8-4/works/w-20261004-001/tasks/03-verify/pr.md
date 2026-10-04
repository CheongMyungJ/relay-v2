# 적립 포인트 기준에서 배송비를 빼고 소수점은 버린다

## 요약
적립 예정 포인트가 고객센터 안내보다 많게 나오던 버그를 고친다. 적립 기준은 배송비를 뺀 결제 금액(상품 − 쿠폰 − 사용 포인트)의 적립률%, 소수점 버림이다. O-1042는 268P에서 237P가 된다.

## 원인
적립 기준을 배송비가 포함된 `order.amounts.total`로 잡고 `percentOf`(반올림)로 계산했다. 선물하기와 부분 환불 회수도 같은 식을 복사해 썼다.

## 변경
- `src/points/earn.js`: `earnBase`, `earnOn`(버림)으로 공통 식을 두고 `earnPoints`가 사용
- `src/money.js`: 버림 도우미 `floorPercentOf` 추가
- `src/gift/gift-points.js`: `earnPoints`에 위임
- `src/orders/refund.js`: 부분 환불 회수 = 환불 전 남은 주문 적립분 − 환불 뒤 남은 주문 적립분. 전체 취소는 저장된 적립을 그대로 회수
- `docs/knowledge/points/`: 적립 규칙과 부분 환불 회수 방식 기록

적립률 값, 영수증 형식은 바꾸지 않았고 저장된 주문은 소급하지 않는다.

## 테스트
- `npm test`: 26개 통과
- `node src/cli.js examples/O-1042.json`: 적립 예정 237P
- 새 `test/earn-rule.test.js`: 배송비 유무, 버림, 선물하기, 부분 환불 2회, 전체 취소
