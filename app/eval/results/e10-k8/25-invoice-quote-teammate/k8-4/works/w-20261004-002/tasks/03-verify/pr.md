# fix: 반품 전표 부가세를 줄마다 원 단위 버림으로 계산

## 요약
반품 전표 환불 금액이 회계팀 계산과 몇 원씩 어긋나던 버그를 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 공급가액 합계에 `Math.round`로 부가세를 한 번 계산했다. 회계팀 규정은 줄마다 원 단위 버림 후 합산이다.

## 변경
- `src/invoice/credit-note.js`: 과세 줄마다 `Math.floor(net × 세율 / 100)`를 계산해 합산. 영세율은 0 유지.
- `test/credit-note.test.js`: CN-0112 재현 테스트와 영세율 테스트 추가.
- `docs/knowledge/invoice/vat-per-line-floor.md`: 규칙에 반품 전표 적용을 반영.
- 이미 만든 반품 전표·발행 청구서의 저장된 `totals`, `src/format/`, 견적은 건드리지 않았다.

## 테스트
- `npm test`: 50 통과, 0 실패
- CN-0112: 수정 전 vat 1,744 / total 19,182 → 수정 후 vat 1,742 / total 19,180
