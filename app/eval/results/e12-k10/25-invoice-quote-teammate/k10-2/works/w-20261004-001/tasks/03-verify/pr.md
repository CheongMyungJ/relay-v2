# 청구서·견적서·반품 전표 부가세를 과세 품목 줄마다 원 미만 절사 후 합산하도록 수정

## 요약
청구서 합계가 회계팀 계산보다 몇 원 크게 나오던 문제를 고쳤다. INV-2031은 vat 2,641원, 합계 29,079원이 된다(기존 2,644원 / 29,082원). 회계 규정은 문서 종류와 무관하므로 견적서(Q-0457 합계 56,278원)와 반품 전표(CN-0112 합계 19,180원)도 같은 방식으로 맞췄다.

## 원인
`computeTotals`가 과세 공급가액 합계에 10%를 곱해 한 번만 반올림했다. 회계팀은 줄마다 절사한 뒤 합산한다. 견적서(할인 전 금액 기준)와 반품 전표(합계 기준 반올림)도 각자 다른 방식으로 합계 단위 계산을 하고 있었다.

## 변경
- `src/invoice/total.js`: 과세 줄마다 `Math.floor(net × 세율 / 100)`로 부가세를 구해 합산. 영세율은 0, 면세 줄은 제외. `lineVat`을 export.
- `src/invoice/quote.js`, `src/invoice/credit-note.js`: 부가세를 `lineVat` 합으로 계산.
- 테스트 추가: `test/total.test.js` 2개, `test/quote.test.js` 2개, `test/credit-note.test.js` 1개.
- `docs/knowledge/invoice/vat-per-line-floor.md`: 문서 종류 무관 줄별 절사 규칙 기록.
- 발행된 문서의 저장 합계와 `src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 53개 통과
- INV-2031 `computeTotals` 직접 실행: vat 2641, total 29079
- Q-0457 vat 3587 / total 56278, CN-0112 vat 1742 / total 19180 (테스트로 확인)
