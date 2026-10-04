# fix: 반품 전표 부가세를 과세 줄마다 버림 후 합산

## 요약
반품 전표(CN-0112)의 환불 부가세·합계가 회계팀 계산과 몇 원 어긋나던 것을 바로잡는다. 1,744원/19,182원 → 1,742원/19,180원.

## 원인
`creditTotals`가 과세 공급가액 합에 세율을 곱해 `Math.round`로 부가세를 구했다. 회계팀 기준은 과세 줄마다 버림 후 합산이다.

## 변경
- `src/invoice/credit-note.js` `creditTotals`: 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)` 후 합산. 영세율은 0 유지.
- `docs/knowledge/billing/vat-per-line-floor.md`: 규칙 문서에 CN-0112 예 추가, 반품 전표를 "따르지 않는 곳"에서 제거.
- 저장된 `totals`가 있는 전표, 청구서 계산, `src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 48개 통과.
- 추가: CN-0112 부가세 1,742원/합계 19,180원 테스트, 저장된 totals 유지 테스트.
