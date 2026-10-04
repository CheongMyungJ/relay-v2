# fix: 반품 전표 부가세를 과세 줄별 버림 합으로 계산

## 요약
반품 전표(`creditTotals`)의 부가세를 과세 줄마다 계산해 합산하도록 고쳤다. CN-0112 환불 합계는 19,182원에서 19,180원이 된다.

## 원인
과세 공급가액 합계(17,438)에 `Math.round`를 한 번 적용해 부가세가 1,744원이 되었다. 회계팀 규칙은 줄별(할인 후 금액 × 10%) 원 단위 버림 합이라 923 + 612 + 207 = 1,742원이다.

## 변경
- `src/money.js`: `floorPercentOf` 추가 (원 단위 버림)
- `src/invoice/credit-note.js`: `creditTotals`의 vat를 과세 줄별 `floorPercentOf` 합으로 계산. 면세 줄 제외, 영세율은 0
- 청구서 계산(`computeTotals`), 할인 계산, 저장된 합계는 바꾸지 않았다
- 머지 주의: 앞 Work(w-20261004-001)도 `floorPercentOf`를 추가했을 수 있다

## 테스트
- `npm test`: 49개 통과
- `test/credit-note.test.js`에 테스트 3개 추가 (CN-0112, 면세·영세율, 줄별 버림)
