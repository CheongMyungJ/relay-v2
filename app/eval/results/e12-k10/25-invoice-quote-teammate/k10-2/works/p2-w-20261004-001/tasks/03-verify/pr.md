# fix: 견적서·청구서 부가세 줄별 절사에 공급가액(net)을 넘기도록 수정

## 요약
견적서 Q-0457의 합계가 경리 기준 56,278원이 되도록, `lineVat` 호출 오류를 고쳤다.

## 원인
`quoteTotals`(견적서)와 `computeTotals`(청구서)가 `rows.map(lineVat)`로 행 객체를 `lineVat(net)`에 넘겨 줄별 부가세가 NaN이 되고 `sumWon`이 예외를 냈다. 반품 전표만 `lineVat(r.net)`으로 올바르게 호출하고 있었다.

## 변경
- `src/invoice/quote.js`, `src/invoice/total.js`: `lineVat(r.net)`으로 호출
- `test/credit-note.test.js`: 중복된 `readFileSync` import 한 줄 삭제 (SyntaxError 해소, 단언 변경 없음)
- `docs/knowledge/invoice/linevat-takes-net-not-row.md`: 같은 실수를 막기 위한 지식 추가

## 테스트
- `npm test`: 54 통과, 0 실패
- Q-0457 견적 합계: supply 52,691 / vat 3,587 / total 56,278 (기존 `test/quote.test.js` 회귀 테스트가 고정)
