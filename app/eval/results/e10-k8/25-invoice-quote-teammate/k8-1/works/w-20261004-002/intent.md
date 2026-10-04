---
schema_version: 1
version: 1
type: bugfix
---
## 목표
반품 전표(`src/invoice/credit-note.js`)의 환불 금액이 회계팀 계산과 몇 원씩 어긋나는 문제를 바로잡는다. 예: CN-0112(INV-2047의 반품)의 환불 합계 19,182원.

## 비목표
- `src/format/`의 출력 형식 변경
- 이미 발행된 청구서와 이미 만든 반품 전표의 재계산 (저장된 `totals`를 그대로 쓴다)
- 청구서(`total.js`)와 견적(`quote.js`)의 계산 변경

## 원하는 결과
새로 만드는 반품 전표의 환불 금액이 회계팀 규칙(할인은 부가세 전에 줄마다 적용, 부가세는 할인 후 과세 줄마다 원 단위 버림 후 합산)과 일치한다. CN-0112는 이 규칙으로 계산한 금액이 나온다.

## 완료조건
- [ ] 재현 절차(examples/CN-0112.json, examples/INV-2047.json으로 반품 전표 생성)가 더 이상 틀린 금액을 내지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] CN-0112의 환불 금액이 줄별 버림 규칙으로 직접 계산한 값과 같다
- [ ] 영세율 반품은 부가세 0, 면세 줄은 부가세에서 제외되는 기존 동작이 유지된다
- [ ] 이미 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 그대로 돌려준다
- [ ] `src/format/` 파일에 변경이 없다

## 제약
- (팀 지식 docs/knowledge/invoice/vat-per-line-floor.md) 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 과세 줄 금액마다 `Math.floor(net * 10 / 100)`로 계산해 합산한다. 합계에서 다시 반올림하지 않는다.
- (팀 지식 docs/knowledge/invoice/issued-totals-are-stored.md) 반품 전표는 `creditNoteTotals`로 저장된 금액을 쓴다. 재계산하지 않는다.
- (팀 지식 docs/knowledge/format/output-frozen.md) `src/format/`의 출력 형식은 바꾸지 않는다.

## 추가 의견
- 없음
