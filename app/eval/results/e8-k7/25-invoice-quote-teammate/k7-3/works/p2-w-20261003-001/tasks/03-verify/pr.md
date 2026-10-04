# fix: 반품 전표 계산에서 빠진 VAT_RATE_PERCENT import 추가

## 요약
`npm test`에서 반품 전표 테스트 5건이 `VAT_RATE_PERCENT is not defined`로 실패하던 것을 고쳤다. 견적서 Q-0457은 기준 커밋에서 이미 56,278원이라 견적서 쪽 변경은 없다.

## 원인
`credit-note.js`가 `VAT_RATE_PERCENT`를 쓰면서 import에 넣지 않았다. 견적서는 이전 커밋(a8348c6)에서 이미 줄별 버림(`vatOfRows`)으로 바뀌어 있었다.

## 변경
- `src/invoice/credit-note.js`: `VAT_RATE_PERCENT` import 1줄 추가
- 계산 로직, 저장된 totals 처리, `quote.js`, `src/format/`, 테스트는 바꾸지 않음

## 테스트
- `npm test`: 53 pass / 0 fail (수정 전 5건 실패)
- Q-0457: total 56,278 / vat 3,587, INV-2031: vat 2,641 / 합계 29,079, CN-0112: vat 1,742 확인
- 견적서 버그는 재현되지 않아 "재현 절차가 더 이상 실패하지 않는다"는 판정 불가
