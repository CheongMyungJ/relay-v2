# fix: 견적 부가세 계산에서 lineVat에 불리언을 넘기고 영세율 견적은 0으로 처리

## 요약
견적서 Q-0457의 합계가 경리 계산 금액 56,278원과 맞도록 `quoteTotals`를 바로잡았다.

## 원인
`quoteTotals`가 `lineVat(net, taxable)`에 `{ taxable, zeroRated }` 객체를 넘겼다. 두 번째 인자는 불리언이라 객체는 항상 참이 되어 면세 줄에도 부가세가 붙고 영세율이 무시됐다(합계 57,958원, 영세율 견적 부가세 9,600원).

## 변경
- `src/invoice/quote.js`: `lineVat(r.net, r.taxable && !quote.zeroRated)`로 호출
- `docs/knowledge/invoice/`: 부가세 규칙 항목을 현재 코드 상태에 맞게 갱신
- 청구서 `computeTotals`의 같은 버그는 비목표라 고치지 않았다.

## 테스트
- `node --test test/quote.test.js`: 4건 통과 (수정 전 2건 실패)
- `npm test`: pass 46 / fail 9. 9건은 기준 커밋에서도 실패하던 `computeTotals` 관련 건이다(수정 전 11건). 새 실패 없음.
