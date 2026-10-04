# fix: 부가세를 품목 줄마다 원 단위 버림으로 계산 (청구서, 반품 전표, 견적)

## 요약
청구서 부가세를 회계 규정대로 품목 줄마다 원 단위 버림으로 계산해 합산한다. INV-2031 합계는 29,082원에서 회계팀 값 29,079원이 된다.

## 원인
`computeTotals`가 과세 공급가액 합계에 부가세를 한 번만 `Math.round`로 계산했다. 반품 전표와 견적도 합계 기준이었다.

## 변경
- `src/money.js`: `floorPercentOf` 추가
- `src/invoice/total.js`: `lineVat` 추가, `computeTotals`가 줄별 합으로 계산
- `credit-note.js`, `quote.js`: 같은 `lineVat` 사용 (견적은 기존 "할인 전 금액에 매기고 할인분 뺌" 규칙 제거)
- 발행된 청구서와 저장된 반품 전표는 저장된 합계를 그대로 쓴다. `src/format/` 변경 없음.
- `docs/knowledge/`에 회계 규칙 3건 추가

## 테스트
- `npm test`: 53개 통과
- INV-2031, 할인 줄, 반품 전표, 견적, 영세율 테스트 추가. 기존 테스트 변경 없음
