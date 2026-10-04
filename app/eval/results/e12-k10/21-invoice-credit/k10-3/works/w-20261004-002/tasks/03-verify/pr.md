# fix: 반품 전표 부가세를 과세 줄마다 원 단위 버림으로 계산해 합산

## 요약
반품 전표의 부가세를 회계팀 규칙대로 돌려받는 과세 줄마다 버림 후 합산하도록 고친다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 공급가액 합계에 세율을 곱해 `Math.round`로 한 번 반올림했다. 줄별 버림 합산과 소수 부분이 달라 몇 원씩 어긋났다.

## 변경
- `src/invoice/credit-note.js`: 부가세를 과세 줄마다 `Math.floor(공급가액 × 세율 / 100)` 하고 합산. 영세율 0, 면세 제외, 저장된 `totals` 사용은 그대로.
- `test/credit-note.test.js`: 테스트 2개 추가.
- `docs/knowledge/billing/vat-calculation.md`: 반품 전표 규칙과 CN-0112 기준값 기록.
- 청구서(`src/invoice/total.js`)와 `src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 48개 통과.
- CN-0112 재현 테스트는 수정 전 실패, 수정 후 통과.
