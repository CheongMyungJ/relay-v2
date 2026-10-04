# fix: 청구서 부가세를 과세 줄마다 할인 후 금액 기준 원 단위 버림으로 계산

## 요약
청구서 부가세를 회계팀 규칙(줄마다 할인 후 금액 기준 원 단위 버림, 합산)에 맞췄다. INV-2031 합계가 29,082원에서 29,079원이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 `Math.round`를 한 번 적용해, 줄별 버림 합보다 몇 원 크게 나왔다.

## 변경
- `src/invoice/total.js`: 과세 줄마다 `Math.floor(net*10/100)`로 계산해 합산. 영세율 0, 면세 줄 제외는 유지.
- `test/total.test.js`: 테스트 2건 추가.
- `docs/knowledge/`: 부가세 계산 규칙, 발행분 합계 유지, 견적서·크레딧노트 별도 계산에 관한 지식 3건.
- 발행된 청구서(저장 합계), 견적서, 크레딧노트, `src/format/`은 바꾸지 않았다.

## 테스트
- `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079
- `npm test` → 50 pass, 0 fail
