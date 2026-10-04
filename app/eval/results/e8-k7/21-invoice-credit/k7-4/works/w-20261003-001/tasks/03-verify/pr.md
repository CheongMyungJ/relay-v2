# fix: 부가세를 줄마다 원 단위 버림 후 합산하도록 수정 (청구서·반품 전표)

## 요약
청구서 부가세가 회계팀 기준보다 몇 원 크게 나오던 문제를 고쳤다. INV-2031은 합계 29,082원에서 29,079원(부가세 2,641원)이 된다. 반품 전표도 같은 규칙으로 맞췄다.

## 원인
`computeTotals`가 과세 공급가액 합에 10%를 한 번 곱해 `Math.round`했다(2643.8 → 2644). 회계팀 기준은 줄마다 버림 후 합산이다. 반품 전표 `creditTotals`에 같은 복사 코드가 있었다.

## 변경
- `src/invoice/total.js`: `lineVat`(줄별 버림), `vatOfRows`(과세 줄만 합산) 추가. `computeTotals`가 사용한다.
- `src/invoice/credit-note.js`: `creditTotals`가 `vatOfRows`를 쓴다.
- `docs/knowledge/`: 부가세 규칙 3건 기록.
- 면세·영세율 규칙, 청구서 서식, 저장된 totals는 바꾸지 않았다.

## 테스트
- `npm test`: 50건 통과(새 테스트 4건 추가, 기존 테스트 변경 없음).
- `node src/cli.js examples/INV-2031.json --totals`: vat 2641, total 29079.
- 이미 저장된 totals는 옛 값이라 몇 원 다를 수 있다(재계산하지 않음).
