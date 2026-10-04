# 부가세를 할인된 줄 금액 기준 줄별 버림으로 계산 (청구서·견적·반품 전표)

## 요약
회계팀 규정대로 부가세를 할인된 과세 줄 금액에 줄마다 원 단위 버림으로 계산해 합하도록 청구서·견적·반품 전표를 고쳤다.

## 원인
부가세를 줄별이 아니라 과세 공급가액 합계에 계산했다. 청구서·반품 전표는 합계에 `Math.round`, 견적은 할인 전 부가세에서 할인분 부가세를 빼는 방식이라 몇 원씩 어긋났다.

## 변경
- `src/invoice/total.js`: `lineVat`, `sumLineVat` 추가, `computeTotals`가 사용
- `src/invoice/quote.js`, `src/invoice/credit-note.js`: 같은 `sumLineVat` 사용
- `test/vat-rule.test.js`: 할인·면세·영세율, 예시 3건 테스트 추가
- `docs/knowledge/billing/vat-per-line-floor.md`: 부가세 규정 기록
- 저장된 `totals` 사용 동작과 `src/format/`은 바뀌지 않음

## 테스트
- `npm test`: 57건 통과
- INV-2031 29,079원(부가세 2,641), Q-0457 56,278원(3,587), CN-0112 19,180원(1,742) 확인
- 수정 전 코드에서는 새 테스트 6건 실패
