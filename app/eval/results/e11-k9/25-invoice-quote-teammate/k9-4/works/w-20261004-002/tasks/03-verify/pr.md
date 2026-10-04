# fix: 반품 전표 부가세를 과세 줄별 원 단위 내림 합산으로 계산

## 요약
반품 전표 CN-0112(청구서 INV-2047의 반품)의 환불 합계가 회계팀 계산과 2원 어긋나던 문제를 고쳤다. 환불 합계는 19,182원에서 19,180원(부가세 1,744원에서 1,742원)이 된다.

## 원인
`creditTotals`가 과세 공급가액 합계에 10%를 한 번 `Math.round`로 매겼다. 회계팀 방식은 과세 줄마다 10%를 원 단위로 내림해 합산한다(17,438 × 10% = 1,743.8이 1,744로 올림되던 것).

## 변경
- `src/invoice/vat.js` (신규): `lineVat`(줄별 내림, 영세율 0), `sumLineVat`
- `src/invoice/credit-note.js`: `creditTotals`의 부가세를 `sumLineVat`으로 교체
- `test/credit-note.test.js`: 테스트 2개 추가 (기존 테스트 변경 없음)
- 저장된 `totals`가 있는 반품 전표는 그대로 저장값을 쓴다(재계산 안 함). `src/format/`은 바꾸지 않았다. 청구서·견적서 계산은 범위 밖이다.

## 테스트
- `npm test`: 50개 통과
- CN-0112: `createCreditNote` 후 `creditNoteTotals`가 `{ supply: 17438, vat: 1742, total: 19180 }`
- 새 테스트: CN-0112 부가세, 저장된 `totals` 그대로 반환
