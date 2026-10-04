# fix: 영세율 문서의 부가세가 0이 되도록 sumLineVat 호출 수정 (견적서 Q-0457 합계 확인)

## 요약
견적서 Q-0457 합계 문의를 조사했다. 현재 코드는 이미 회계팀 규칙대로 56,278원이고, 56,280원은 2076df4 이전 방식의 값이다. 조사 중 찾은 영세율 문서 부가세 결함을 고쳤다.

## 원인
`sumLineVat(rows, { zeroRated })`는 옵션 객체를 받는데 `quote.js`와 `total.js`가 불리언을 넘겨 영세율이 무시됐다.

## 변경
- `src/invoice/quote.js`, `src/invoice/total.js`: `{ zeroRated }` 객체로 전달
- `test/vat-per-line.test.js`: 영세율 견적서 부가세 0 테스트 추가
- `docs/knowledge/billing/vat-per-line-floor.md`: 옵션 객체 규칙과 발송된 견적서 재발행 안 함 기록
- 견적 번호, 유효 기간, 발행된 청구서의 저장 totals는 바꾸지 않음

## 테스트
- `npm test`: 60 통과
- `node src/cli.js examples/Q-0457.json`: vat 3,587 / 합계 56,278
