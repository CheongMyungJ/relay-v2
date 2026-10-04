---
schema_version: 1
version: 1
type: bugfix
---
## 목표
반품 전표(`creditTotals`)의 환불 금액이 회계팀 계산과 몇 원씩 어긋나는 버그를 고친다. 예: CN-0112(청구서 INV-2047의 반품)의 환불 합계가 19,182원으로 나온다.

## 비목표
- 청구서(`computeTotals`) 계산 변경
- `src/format/` 출력 형식 변경
- 이미 발행된 반품 전표·청구서에 저장된 `totals` 재계산

## 원하는 결과
반품 전표의 부가세와 환불 합계가 회계 규정대로 계산된다. CN-0112의 환불 합계가 회계팀 계산과 일치한다.

## 완료조건
- [ ] 재현 절차(examples/CN-0112.json을 examples/INV-2047.json에 반품한 전표의 환불 합계 확인)가 더 이상 실패한다고 보이지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 반품 전표 부가세가 과세 줄마다 (할인 후 줄 금액 × 세율)을 원 단위로 버림한 값의 합이다
- [ ] 면세 줄과 영세율(`zeroRated`) 전표의 부가세는 0이다
- [ ] 위 규칙을 확인하는 테스트(CN-0112 포함)가 추가된다

## 제약
- (팀 지식 `docs/knowledge/invoice/vat-per-line-floor.md`) 반품 전표 부가세는 과세 품목 줄마다 (할인 후 줄 금액 × 세율)을 원 단위로 버림해 합산한다. 합계에서 부가세를 다시 계산·반올림·절사하지 않는다. 할인은 부가세 전에 줄마다 적용한다.
- (팀 지식 `docs/knowledge/invoice/issued-invoice-and-format-output.md`) 발행분은 저장된 `totals`를 그대로 쓰고, `src/format/` 출력은 바꾸지 않는다.

## 추가 의견
- (사람 추정, 확인 안 됨) 관련 코드는 `src/invoice/credit-note.js`.
