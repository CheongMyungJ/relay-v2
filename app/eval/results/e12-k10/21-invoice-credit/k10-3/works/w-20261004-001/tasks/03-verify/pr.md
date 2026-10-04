# fix: 부가세를 줄별 원 단위 버림으로 계산해 합산

## 요약
청구서 합계가 회계팀 계산보다 몇 원 크게 나오던 문제를 고쳤다. INV-2031 합계가 29,082원에서 29,079원이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 세율을 곱해 한 번 `Math.round`했다. 회계팀 기준은 줄마다 버림 후 합산이라 줄별 소수 부분이 합쳐져 올라가면 몇 원 더 크게 나왔다.

## 변경
- `src/invoice/total.js`: 부가세를 과세 줄마다 `Math.floor(net * 세율 / 100)`로 계산해 합산. 합계는 공급가액 + 부가세.
- `test/total.test.js`: INV-2031 합계, 할인·면세 혼합 줄 테스트 2개 추가.
- `docs/knowledge/billing/vat-calculation.md`: 부가세 계산 규칙과 미정 사항 기록.
- 발행된 청구서(저장 합계)와 `src/format/`은 바꾸지 않았다. 반품 전표 `creditTotals`는 이번 범위에서 제외(회계팀 확인 후 결정).

## 테스트
- `npm test`: 48개 통과
- `node src/cli.js examples/INV-2031.json --totals`: vat 2641, total 29079
