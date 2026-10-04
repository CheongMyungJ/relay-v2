# fix: 부가세를 과세 줄마다 원 단위 버림한 합으로 계산

## 요약
회계팀 규정(부가세는 과세 줄마다 원 단위 버림, 그 합이 부가세)대로 계산해 INV-2031 합계를 29,082원에서 29,079원으로 바로잡는다. 반품 전표도 같은 규칙을 쓴다.

## 원인
`computeTotals`가 과세 공급가액 합에 `Math.round`를 한 번만 적용했다(26,438×10% → 2,644). 규정은 줄별 버림의 합(2,641)이다. 반품 전표 `creditTotals`에 같은 식이 복사되어 있었다.

## 변경
- `src/invoice/total.js`: `lineVat`, `sumLineVat` 추가, `computeTotals`가 사용
- `src/invoice/credit-note.js`: `creditTotals`가 `sumLineVat` 사용
- `docs/knowledge/invoice/`: 부가세 규칙과 발행 청구서 저장 합계 규칙 기록
- 발행·저장 경로와 `src/format/`은 변경 없음

## 테스트
- `npm test`: 50개 통과
- 추가: INV-2031 줄별 버림, 할인 줄, 면세 혼합, 반품 전표 부가세
