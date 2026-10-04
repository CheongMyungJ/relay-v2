# fix: 청구서 부가세를 과세 줄마다 원 단위 버림 후 합산

## 요약
청구서 합계가 회계팀 계산보다 몇 원씩 크게 나오던 문제를 고쳤다. INV-2031은 vat 2644 → 2641, total 29082 → 29079이다.

## 원인
`computeTotals`가 과세 공급가액 합계에 세율을 곱해 한 번만 `Math.round`했다. 회계팀은 줄마다 버림한 값을 합산한다.

## 변경
- `src/invoice/total.js`: 과세 줄마다 `Math.floor(net × 세율 / 100)`을 합산. 영세율은 0, 면세 줄은 제외.
- `test/total.test.js`: 줄별 버림 합산과 할인 줄 테스트 2개 추가.
- `docs/knowledge/billing/vat-per-line-floor.md`: 회계팀 부가세 규칙 기록.
- 범위 밖: `src/invoice/credit-note.js:90`은 아직 합계 기준 `Math.round`다.

## 테스트
- `npm test`: 48개 통과
- `node src/cli.js examples/INV-2031.json --totals`: vat 2641, total 29079
