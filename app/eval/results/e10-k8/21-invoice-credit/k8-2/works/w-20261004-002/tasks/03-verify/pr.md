# fix: 반품 전표 부가세를 과세 줄별 버림 합으로 계산

## 요약
반품 전표 부가세가 과세 공급가액 합계에 10%를 매겨 반올림한 값이라 회계팀 방식(줄별 버림 합)과 몇 원씩 어긋났다. CN-0112는 부가세 1,744원 → 1,742원, 합계 19,182원 → 19,180원이 된다.

## 원인
`creditTotals`가 `Math.round((taxable * 10) / 100)`로 합계에서 한 번만 반올림했다. 줄 금액이 10원 단위면 두 방식이 같아 기존 테스트로 잡히지 않았다.

## 변경
- `src/invoice/vat.js` 신규: `computeVat(rows, zeroRated)` — 과세 줄마다 `Math.floor(net × 10%)`의 합, 영세율이면 0
- `src/invoice/credit-note.js`: `creditTotals`가 `computeVat` 사용
- 저장된 `totals`(`creditNoteTotals`), 청구서 합계, `src/format/`은 변경 없음

## 테스트
- `npm test`: 50 pass, 0 fail
- 추가: 10원 단위가 아닌 금액과 할인 줄, 영세율, 저장된 totals, CN-0112 예시 테스트
