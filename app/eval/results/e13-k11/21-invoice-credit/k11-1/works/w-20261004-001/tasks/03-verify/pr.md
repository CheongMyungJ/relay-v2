# fix: 부가세를 줄별 원 단위 버림 합으로 계산 (청구서, 반품 전표)

## 요약
청구서 합계가 회계팀 계산보다 크게 나오던 문제를 고친다. 부가세를 줄마다 계산해 합산한다. INV-2031은 29,082원에서 29,079원이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 부가세율을 곱해 한 번만 `Math.round`했다(2643.8→2644). 회계팀 규칙은 할인 후 줄 금액 기준 줄별 버림 합(2,641)이다. 같은 식이 반품 전표 `creditTotals`에도 복사돼 있었다.

## 변경
- `src/invoice/total.js`: `lineVat` 추가(할인 후 줄 금액, 과세 줄만, `Math.floor`, 영세율이면 0). `computeTotals`가 줄별 합을 쓴다.
- `src/invoice/credit-note.js`: `creditTotals`도 `lineVat` 합을 쓴다.
- `docs/knowledge/invoice/`: 부가세 줄별 버림 규칙과 발행 청구서 저장 합계 규칙을 남겼다.
- 발행된 청구서와 저장된 반품 전표는 재계산하지 않는다. `src/format/`은 바뀌지 않는다.

## 테스트
- `npm test`: 50 pass / 0 fail (테스트 4건 추가, 기존 테스트 변경 없음)
- `node /tmp/repro.mjs`: INV-2031 vat 2,641 / total 29,079
