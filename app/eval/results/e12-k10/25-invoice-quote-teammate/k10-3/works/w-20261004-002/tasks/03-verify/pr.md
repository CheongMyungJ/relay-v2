# fix: 반품 전표 부가세를 과세 줄마다 원 단위 버림으로 계산

## 요약
반품 전표(CN-0112)의 환불 합계가 회계팀 계산보다 2원 많던 문제를 고쳤다. 19,182원 → 19,180원.

## 원인
`creditTotals`가 과세 공급가액 합계에 10%를 곱해 한 번에 `Math.round`했다(1,743.8 → 1,744). 회계팀 규칙은 줄마다 할인 후 금액 × 10%를 버림해 더하는 것이다(923+612+207 = 1,742).

## 변경
- `src/invoice/total.js`: `lineVat(net, taxable)` 추가(원 단위 버림, 면세 0).
- `src/invoice/credit-note.js`: `creditTotals`의 부가세를 줄별 `lineVat` 합으로 변경. 영세율은 0 그대로.
- `docs/knowledge/invoice/vat-rule.md`: 부가세 규칙과 아직 따르지 않는 곳, 미정 사항을 정리.
- 저장된 `totals`가 있는 반품 전표와 발행된 청구서, `src/format/`은 바꾸지 않았다. `computeTotals`/`quoteTotals`도 범위 밖이라 그대로다. 원 청구서와의 부가세 보정도 하지 않았다.

## 테스트
- `npm test`: 51개 통과.
- 추가한 테스트: CN-0112 재현(부가세 1,742, 합계 19,180), 저장된 totals 재계산 안 함, 면세 줄 섞임·영세율 반품 전표.
- 머지 주의: 앞 Work(w-20261004-001)가 `lineVat`을 이미 추가했다면 충돌할 수 있다.
