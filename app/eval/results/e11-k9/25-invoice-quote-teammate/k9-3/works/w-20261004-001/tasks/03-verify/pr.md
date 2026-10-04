# 청구서·견적서·반품 전표 부가세를 줄별 원 단위 버림 합으로 계산

## 요약
부가세를 회계팀 규칙(품목 줄마다 원 단위 버림 후 합산)으로 맞춰 INV-2031 합계가 29,082원에서 29,079원이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 한 번만 `Math.round`를 해 줄별 버림 합과 달랐다. 견적서는 할인 전 총액 기준 반올림, 반품 전표는 총액 반올림이었다.

## 변경
- `src/invoice/vat.js` 신설: `lineVat`, `sumLineVat`. 청구서·견적서·반품 전표가 공유한다.
- 발행된 청구서의 저장된 totals와 `src/format/` 출력은 그대로다.
- 규칙을 `docs/knowledge/billing/`에 기록했다.

## 테스트
- `npm test` 55 pass / 0 fail
- `test/vat-per-line.test.js` 추가(수정 전 코드에서 실패 확인)
- INV-2031, Q-0457, CN-0112는 손계산과 일치. INV-2047은 발행분이라 저장값 유지
