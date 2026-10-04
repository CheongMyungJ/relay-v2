# fix: 청구서·반품 전표 부가세를 줄별 원 단위 버림으로 계산

## 요약
부가세를 과세 공급가액 합계에 한 번 반올림하던 방식에서, 회계팀 규정대로 줄마다 원 단위 버림 후 합산하도록 바꿨다. 청구서와 반품 전표에 모두 적용한다.

## 원인
`computeTotals`(`src/invoice/total.js`)와 `creditTotals`(`src/invoice/credit-note.js`)가 `Math.round(taxable * 10 / 100)`로 합계 단위 반올림을 했다. INV-2031은 줄별 버림 합 2,641원인데 2,644원이 나왔다.

## 변경
- `lineVat` 추가(줄별 버림), `computeTotals`와 `creditTotals`가 과세 줄마다 합산
- 영세율 0원, 면세 줄 제외는 유지
- 저장된 합계를 쓰는 경로와 `src/format/`은 변경 없음

## 테스트
- `npm test`: 50개 통과
- 추가: INV-2031(부가세 2,641원, 합계 29,079원), CN-0112(부가세 1,742원, 합계 19,180원), 영세율·면세 케이스
