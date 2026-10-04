# fix: 견적서·청구서 부가세 합산 호출을 sumLineVat 시그니처에 맞게 수정

## 요약
견적서 Q-0457 합계가 틀리던(실제로는 TypeError) 문제를 고쳤다. 부가세는 과세 줄마다 원 단위 내림 후 합산한 값이며 Q-0457은 부가세 3,587원, 합계 56,278원이다.

## 원인
3cccc30이 `sumLineVat`을 과세 줄 net 숫자 배열 입력으로 바꾸고 credit-note.js만 맞췄다. quote.js와 total.js는 줄 객체 배열을 그대로 넘겨 TypeError가 났고, 면세 줄 제외도 빠졌다.

## 변경
- src/invoice/quote.js, src/invoice/total.js: `sumLineVat`에 과세 줄 net 배열을 넘김
- docs/knowledge/invoice/vat-per-line-floor.md: `sumLineVat` 입력 형식 기록
- 서식(src/format), 견적 번호, `quoteValidUntil`은 변경 없음

## 테스트
- `npm test`: 52 통과 / 0 실패 (수정 전 19개 실패)
- 재현 명령으로 Q-0457 합계 56,278원 확인, test/quote.test.js:34가 손계산 값을 단언
