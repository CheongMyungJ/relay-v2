# fix: 반품 전표 부가세를 줄별 원 단위 버림 합으로 계산

## 요약
반품 전표 환불 합계가 회계팀 계산과 몇 원씩 어긋나던 문제를 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 부가세를 과세분 합계에 한 번만 곱해 반올림했다. 회계팀 규정은 줄마다 원 단위 미만을 버린 합이다.

## 변경
- `src/invoice/total.js`: `lineVatSum(rows, zeroRated)` 추가
- `src/invoice/credit-note.js`: `creditTotals`가 `lineVatSum`을 사용. 저장된 `totals`를 쓰는 `creditNoteTotals`와 `src/format/`은 그대로
- `docs/knowledge/invoice/vat-per-line-floor.md`: 규칙에 CN-0112 예와 아직 따르지 않는 곳(청구서·견적) 기록
- 청구서·견적 계산은 비목표라 바꾸지 않음

## 테스트
- `npm test` 51건 통과
- 회귀 테스트: CN-0112 합계 19,180원과 저장된 합계 유지, `lineVatSum` 면세·영세율·할인 케이스
