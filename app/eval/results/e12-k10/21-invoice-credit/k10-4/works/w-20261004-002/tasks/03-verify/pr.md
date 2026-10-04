# fix: 반품 전표 부가세를 과세 줄마다 버림한 합으로 계산

## 요약
반품 전표의 부가세를 과세 합계에서 한 번 반올림하던 방식에서 과세 줄마다 원 단위로 버림한 합으로 바꿨다. CN-0112 환불 합계는 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 `Math.round(과세 합계 × 세율 / 100)`로 부가세를 계산했다. 줄별 버림 규칙(회계팀)과 달라 몇 원씩 어긋났다. CN-0112는 줄 부가세 923+612+207=1,742원인데 합계 반올림은 1,744원이었다.

## 변경
- `src/invoice/total.js`: `lineVat`/`sumLineVat` 추가
- `src/invoice/credit-note.js`: `creditTotals`가 `sumLineVat` 사용. 저장된 `totals`를 쓰는 `creditNoteTotals`는 그대로
- `docs/knowledge/billing/vat-per-line-floor.md`: 반품 전표 적용과 CN-0112 값 기록
- 청구서 `computeTotals`, `src/format/`은 변경 없음

## 테스트
- `npm test`: 48건 통과
- 추가: CN-0112 부가세 1,742원/합계 19,180원, 영세율·면세 반품 전표 테스트
