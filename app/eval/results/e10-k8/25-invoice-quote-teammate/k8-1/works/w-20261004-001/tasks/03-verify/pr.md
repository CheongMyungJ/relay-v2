# fix: 청구서 부가세를 줄별 원 단위 버림으로 계산

## 요약
청구서 합계가 회계팀 계산보다 몇 원 크게 나오던 문제를 고친다. INV-2031 합계가 29,082원에서 29,079원이 된다. 견적과 반품 전표도 같은 규칙으로 맞췄다.

## 원인
`computeTotals`가 과세 공급가액 합계에 부가세를 한 번 매기고 `Math.round`로 반올림했다(round(2643.8)=2,644). 회계팀 규칙은 할인 후 줄 금액마다 버림 계산한 합(2,641)이다.

## 변경
- `src/invoice/total.js`: 줄별 `Math.floor` 부가세(`lineVat`)를 합산한다.
- `src/invoice/quote.js`, `src/invoice/credit-note.js`: 같은 규칙으로 맞췄다. 리뷰에서 선택한 변경이다.
- 발행된 청구서는 저장된 합계를 그대로 쓰고, `src/format/`은 바꾸지 않았다.
- `docs/knowledge/`에 부가세 규칙, 저장 합계, 서식 고정 규칙을 남겼다.

## 테스트
- `npm test`: 52개 통과
- `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079
- 새 테스트: INV-2031, 할인·면세 혼합, 견적, 반품 전표
