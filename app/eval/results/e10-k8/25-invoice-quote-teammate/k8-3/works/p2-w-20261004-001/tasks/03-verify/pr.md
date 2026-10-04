# fix: 반품 전표 부가세가 lineVat를 쓰도록 고치고 견적 Q-0457 합계 테스트 추가

## 요약
머지 뒤 깨진 반품 전표 합계 계산을 `lineVat`로 고치고, 견적 Q-0457 합계 회귀 테스트를 추가했다.

## 원인
견적서(`quoteTotals`)는 기준 브랜치에서 이미 줄별 버림으로 56,278원이다(문의의 56,280원은 수정 전 합계 반올림 값). 대신 w-20261004-002 머지 때 `creditTotals`가 `lineVat`를 import하면서 정의 없는 `VAT_RATE_PERCENT` 계산을 남겨 반품 전표 테스트 6건이 실패했다.

## 변경
- `src/invoice/credit-note.js`: `creditTotals`가 `lineVat(r.net)` 사용
- `test/quote.test.js`: Q-0457 합계(부가세 3,587원, 합계 56,278원) 테스트 추가
- `docs/knowledge`: 부가세 규칙의 미준수 항목 해소, 견적 번호·유효 기간 계약 지식 추가

## 테스트
`npm test`: 54 통과, 0 실패
