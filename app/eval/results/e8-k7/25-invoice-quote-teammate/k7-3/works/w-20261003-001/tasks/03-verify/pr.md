# fix: 청구서 부가세를 줄별 원 단위 버림 합으로 계산

## 요약
청구서 부가세를 회계팀 기준(줄별 할인 후 금액에 부가세, 원 단위 버림, 합산)에 맞췄다. INV-2031 합계가 29,082원에서 29,079원이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 한 번만 `Math.round`로 부가세를 계산해 줄별 버림 합과 몇 원씩 차이가 났다.

## 변경
- `src/invoice/total.js`: 과세 줄마다 `Math.floor`한 부가세를 합산한다. 영세율은 0원 그대로다.
- `test/total.test.js`: 줄별 버림, 할인·면세 혼합, 영세율 테스트 3개 추가.
- `docs/knowledge/`: 회계팀 기준과 발행분·`src/format/` 불변 규칙, 전표·견적서 계산이 별도임을 기록.
- 발행된 청구서는 저장된 합계를 쓰므로 바뀌지 않고, `src/format/`은 변경 없음. 전표와 견적서는 범위 밖이다.

## 테스트
- `npm test`: 51개 통과
- `node src/cli.js examples/INV-2031.json --totals`: vat 2641, total 29079
