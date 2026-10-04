# fix: 부가세를 과세 줄마다 원 단위 버림 후 합산하도록 수정 (청구서·반품 전표)

## 요약
청구서 합계가 회계팀 계산보다 몇 원 크게 나오던 문제를 고친다. INV-2031은 합계 29,082원에서 29,079원(부가세 2,641원)이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 부가세를 한 번만 `Math.round`로 계산했다. 회계팀 규칙은 과세 줄마다 할인 후 금액에 원 단위 버림 후 합산이다. 반품 전표(`creditTotals`)에도 같은 식이 있었다.

## 변경
- `src/money.js`: `floorPercentOf`(원 단위 버림 비율 계산) 추가
- `src/invoice/total.js`, `src/invoice/credit-note.js`: 줄별 버림 후 합산. 영세율은 0, 면세 줄은 제외
- `docs/knowledge/invoice/vat-per-line-floor.md`: 규칙 기록
- 이미 발행된 청구서 재계산과 `src/format/` 변경은 하지 않았다.

## 테스트
- `npm test`: 50개 통과
- 추가: `test/total.test.js` 3개(INV-2031, 할인 줄, 면세 줄), `test/credit-note.test.js` 1개
- 수정 전 4개 실패 확인
