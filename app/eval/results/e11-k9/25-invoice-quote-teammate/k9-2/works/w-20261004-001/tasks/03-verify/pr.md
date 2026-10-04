# fix: 청구서 부가세를 과세 줄마다 원 미만 버림 후 합산

## 요약
새로 계산하는 청구서의 부가세를 과세 줄마다 원 미만을 버린 뒤 합산하도록 바꿨다. INV-2031은 부가세 2,641원, 합계 29,079원이 된다(기존 29,082원).

## 원인
`computeTotals`가 과세 공급가액 합계에 `Math.round`를 한 번만 적용해, 줄별 버림 합보다 몇 원 크게 나왔다.

## 변경
- `src/invoice/total.js`: 과세 줄마다 `Math.floor(net × 10 / 100)` 후 합산. 영세율은 0 유지.
- `test/total.test.js`: 테스트 2개 추가(INV-2031, 면세 줄과 영세율).
- `docs/knowledge/invoice/vat-per-line-floor.md`: 부가세 규칙과 아직 따르지 않는 곳을 기록.
- 발행된 청구서(저장된 `totals`), `src/format/`, 견적서, 반품 전표는 바꾸지 않았다.

## 테스트
- `npm test`: 50개 통과
- `node src/cli.js examples/INV-2031.json --totals`: vat 2641, total 29079
