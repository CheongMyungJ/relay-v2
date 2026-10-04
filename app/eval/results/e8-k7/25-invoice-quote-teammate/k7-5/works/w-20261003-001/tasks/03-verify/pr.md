# fix: 청구서 부가세를 과세 줄별 원 단위 버림 합으로 계산

## 요약
청구서(INV-2031) 합계가 회계팀 계산(29,079원)보다 3원 큰 29,082원으로 나오던 문제를 고친다.

## 원인
`computeTotals`가 과세 공급가액 합계 전체에 한 번만 `Math.round`로 부가세를 계산했다. 회계팀은 줄마다 원 단위 버림으로 계산해 합산한다.

## 변경
- `src/invoice/total.js`: 과세 줄마다 `floor(net×세율/100)`을 구해 합산한다. 영세율은 0이다.
- `test/total.test.js`: INV-2031, 할인·면세, 영세율 테스트 3건을 추가했다.
- `docs/knowledge/`: 회계 규칙과 주의점을 남겼다.
- `src/invoice/quote.js`, `src/invoice/credit-note.js`: 같은 `lineVat`으로 줄별 버림 합을 쓴다. Q-0457은 56,278원, CN-0112는 19,180원이 된다.
- `test/quote.test.js`, `test/credit-note.test.js`: 테스트 3건을 추가했다.
- `src/format/`과 발행분의 저장 합계 처리는 바꾸지 않았다.

## 테스트
- `npm test`: 54 pass, 0 fail
- `node src/cli.js examples/INV-2031.json --totals`: vat 2641, total 29079
- Q-0457: total 56278 / CN-0112: total 19180
