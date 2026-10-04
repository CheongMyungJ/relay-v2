# fix: 반품 전표 부가세를 줄별 원 단위 버림으로 계산

## 요약
반품 전표(`creditTotals`)의 부가세가 회계팀 규칙과 몇 원 어긋나던 문제를 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
부가세를 과세 공급가액 합계에 한 번 `Math.round`로 계산했다(1743.8 → 1,744). 규칙은 줄마다 원 단위 버림 합산이다(923+612+207 = 1,742).

## 변경
- `src/invoice/credit-note.js`: 과세 줄마다 `Math.floor(net*10/100)`로 계산해 합산. 영세율은 0.
- 저장된 `totals`는 그대로 돌려주는 기존 동작 유지. `src/format/`, `computeTotals`는 변경 없음.
- `docs/knowledge/billing/vat-per-line-floor.md`: CN-0112 사례와 `lineVat` 교체 대기 항목 추가.

## 테스트
- `npm test`: 50개 통과.
- 추가: CN-0112 부가세 1,742원/합계 19,180원, 저장된 `totals` 유지.
