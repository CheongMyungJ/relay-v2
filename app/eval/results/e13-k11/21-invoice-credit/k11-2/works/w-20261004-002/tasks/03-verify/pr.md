# fix: 반품 전표 부가세를 줄마다 원 단위 버림으로 계산

## 요약
새로 만드는 반품 전표의 환불 금액이 회계팀 계산과 몇 원씩 어긋나던 문제를 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 공급가액 합계에 부가세를 한 번만 반올림해 계산했다. 회계 규정은 줄마다 원 단위 버림 후 합산이다(CN-0112: 1,743.8 → 1,744 대 923+612+207 = 1,742).

## 변경
- `src/invoice/total.js`: `lineVat(net)` 추가(줄 하나의 부가세, 원 단위 버림)
- `src/invoice/credit-note.js`: `creditTotals`가 과세 줄마다 `lineVat`를 합산. 영세율은 0원, 면세 줄 제외
- 청구서 `computeTotals`, 저장된 `totals`가 있는 전표(`creditNoteTotals`), `src/format/`은 바꾸지 않음

## 테스트
- `npm test`: 48 pass, 0 fail
- 추가: CN-0112 부가세·합계(19,180원) 테스트, 저장된 금액이 있는 전표는 다시 계산하지 않는 테스트
