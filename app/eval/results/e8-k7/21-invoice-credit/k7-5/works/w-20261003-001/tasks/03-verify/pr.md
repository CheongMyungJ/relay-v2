# fix: 부가세를 줄별 원 단위 버림 합으로 계산

## 요약
청구서 합계가 회계팀 계산보다 몇 원씩 크게 나오던 문제를 고쳤다. INV-2031은 29,082원에서 회계팀 값인 29,079원이 된다. 반품 전표도 같은 규칙으로 맞췄다.

## 원인
`computeTotals`가 과세 공급가액 합에 부가세를 한 번만 `Math.round`해(2,643.8 → 2,644) 줄별 버림 합(2,641)보다 커졌다. `creditTotals`도 같은 방식이었다.

## 변경
- `src/invoice/vat.js` 신규: 과세 줄마다 할인 후 공급가액에 `floor`로 부가세를 구해 합하는 `rowsVat`. 영세율이면 0.
- `src/invoice/total.js`, `src/invoice/credit-note.js`가 `rowsVat`를 쓴다.
- `src/format/`과 발행된 청구서의 저장 합계는 바꾸지 않았다.
- 팀 지식 `docs/knowledge/` 4건 추가.

## 테스트
- `npm test`: 49개 모두 통과 (추가 3개, 수정 전에는 3개 실패).
- `examples/INV-2031.json` 계산 결과: vat 2,641, total 29,079.
