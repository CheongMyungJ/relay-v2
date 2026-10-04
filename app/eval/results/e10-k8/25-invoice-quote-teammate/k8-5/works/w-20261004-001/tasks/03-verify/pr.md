# 부가세를 할인된 줄 금액에 줄마다 원 단위 버림으로 계산 (청구서, 반품 전표, 견적서)

## 요약
회계팀 규정에 맞춰 부가세를 줄마다 계산해 합산한다. INV-2031은 부가세 2,641원, 합계 29,079원(기존 29,082원).

## 원인
`computeTotals`가 과세 공급가액 합계에 10%를 곱해 한 번 반올림했다. 규정은 줄마다 원 단위 버림 후 합산이다. 반품 전표와 견적서도 같은 방식 문제가 있었다.

## 변경
- `src/invoice/total.js`: `lineVat`, `sumLineVat` 추가, `computeTotals`가 사용
- `src/invoice/credit-note.js`, `src/invoice/quote.js`: 같은 함수 사용
- 발행된 청구서·반품 전표는 재계산하지 않음, `src/format/` 변경 없음
- `docs/knowledge/billing/`에 규칙과 주의점 기록

## 테스트
`npm test`: 52 pass / 0 fail. INV-2031, 할인 줄, 반품, 견적 테스트 추가.
