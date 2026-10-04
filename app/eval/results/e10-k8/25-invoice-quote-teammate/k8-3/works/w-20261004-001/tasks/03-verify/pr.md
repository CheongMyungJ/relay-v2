# 청구서 부가세를 품목 줄마다 원 단위 버림으로 계산

## 요약
청구서 합계가 회계팀 계산보다 몇 원 크게 나오던 문제를 고쳤다. INV-2031 합계는 29,082원에서 29,079원이 된다. 견적서와 반품 전표도 같은 규칙을 쓰게 맞췄다.

## 원인
`computeTotals`가 과세 공급가액 합계에 한 번만 `Math.round`로 부가세를 계산했다(2643.8 → 2644). 회계팀 규칙은 할인 후 줄 금액마다 원 단위 버림 후 합산이라 2,641원이다.

## 변경
- `src/invoice/total.js`: `lineVat`(줄별 `Math.floor`)를 추가하고 부가세를 줄별 합으로 계산한다.
- `src/invoice/quote.js`, `src/invoice/credit-note.js`: 같은 `lineVat`를 쓴다.
- `docs/knowledge/billing/vat-per-line-floor.md`: 회계팀 규칙을 팀 지식으로 남겼다.
- 발행된 청구서의 저장 합계 사용 방식과 `src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 52개 통과 (청구서 2개, 견적 1개, 반품 전표 1개 추가. 기존 테스트 변경 없음)
- INV-2031: vat 2,641 / total 29,079 확인
