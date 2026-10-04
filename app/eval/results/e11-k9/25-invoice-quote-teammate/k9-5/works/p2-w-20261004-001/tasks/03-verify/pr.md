# fix: 반품 전표 부가세를 공용 sumLineVat으로 계산

## 요약
`creditTotals`가 import하지 않은 `VAT_RATE_PERCENT`를 참조해 `npm test`가 7건 실패하던 것을 고쳤다. Q-0457 견적 합계는 이미 경리와 같은 56,278원이다.

## 원인
`creditTotals`가 `sumLineVat` 대신 줄별 `Math.floor`를 직접 계산하면서 없는 상수를 참조해 ReferenceError가 났다.

## 변경
- `src/invoice/credit-note.js`: 부가세를 `sumLineVat(rows, note.zeroRated)`로 계산
- `docs/knowledge/billing/vat-per-line-floor.md`: 규칙을 따르지 않던 곳 항목 제거, 이력 추가

## 테스트
- `npm test`: 58건 통과
- `node src/cli.js examples/Q-0457.json`: 합계 56278
- 기존 Q-0457, CN-0112 단언이 재현 테스트 역할을 한다. 56,280원의 출처는 코드에서 찾지 못했다.
