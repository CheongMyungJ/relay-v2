# fix: 반품 전표 부가세를 과세 줄마다 원 단위 버림으로 계산

## 요약
반품 전표(`creditTotals`)의 부가세를 과세 줄마다 원 단위로 버림해 합산하도록 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
과세 공급가액 합계(17,438)에 한 번 `Math.round`로 부가세를 계산해(1,744), 줄별 버림 합(923+612+207=1,742)과 어긋났다.

## 변경
- `src/invoice/credit-note.js`: 과세 줄마다 `percentOfFloor`로 버림해 합산. 영세율과 면세 줄은 0
- `src/money.js`: `percentOfFloor` 추가(앞 Work와 겹칠 수 있어 머지 때 확인)
- `docs/knowledge/billing/vat-rounding.md`: 부가세 규칙과 CN-0112 예, 미정 사항(부분 반품 할인 반올림)
- 저장된 `totals`, `src/format/`은 바뀌지 않음

## 테스트
- `npm test`: 50 통과, 0 실패
- 추가: CN-0112 줄별 부가세, 면세·영세율 테스트
