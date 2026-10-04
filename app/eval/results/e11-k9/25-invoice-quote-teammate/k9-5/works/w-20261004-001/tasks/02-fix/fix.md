## 재현
- 재현 절차: `node --test test/vat-rule.test.js` (수정 전 코드에서). 또는 `computeTotals(createInvoice(examples/INV-2031.json))`, `createQuote(examples/Q-0457.json).totals`, `createCreditNote(INV-2047, CN-0112).totals`
- 결과: 재현됨
- 기대: INV-2031 부가세 2,641 / 합계 29,079, Q-0457 부가세 3,587 / 합계 56,278, CN-0112 부가세 1,742 / 합계 19,180
- 실제: 수정 전 INV-2031 합계 29,082, Q-0457 3,589 / 56,280, CN-0112 1,744 / 19,182 (테스트 6건 실패)

## 원인
- 원인: 부가세를 줄별이 아니라 과세 공급가액 합계에 계산했다. 청구서·반품 전표는 합계에 `Math.round`(올림 가능), 견적은 할인 전 금액 부가세에서 할인분 부가세를 빼는 방식(각각 반올림)이라 규정(줄별 버림의 합)과 몇 원 어긋났다.
- 근거: `src/invoice/total.js:26`, `src/invoice/credit-note.js:90`, `src/invoice/quote.js:42-43`(수정 전). 줄별 버림 합으로 바꾸자 예시 3건이 기대값과 일치하고, 되돌리면 다시 실패한다(수정 전/후 실험). 줄 금액이 10원 단위로 딱 떨어지거나 줄이 하나일 때는 어긋나지 않아 기존 테스트가 통과했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음 (intake의 세 곳 가설은 모두 확인되어 원인이 됨)

## 변경 요약
- `src/invoice/total.js` — `lineVat`(할인된 줄 금액 × 10% 버림)과 `sumLineVat`(과세 줄만 합, 영세율은 0) 추가, `computeTotals`가 사용
- `src/invoice/quote.js` — `quoteTotals`가 `sumLineVat` 사용. 미사용 import 정리
- `src/invoice/credit-note.js` — `creditTotals`가 `sumLineVat` 사용. 미사용 import 정리
- `test/vat-rule.test.js` — 새 테스트(기존 테스트 변경 없음)
- 할인 금액 계산, 저장된 `totals` 사용 동작, `src/format/`은 건드리지 않음

## 재현 테스트
- 위치: `test/vat-rule.test.js` (청구서·견적·반품 전표 각각 할인 과세 줄 + 면세 줄, 영세율, 예시 3건)
- 수정 전: 실패 (`git stash`로 src만 되돌리고 `npm test`: 6건 not ok, pass 49 / fail 6)
- 수정 후: 통과 (`npm test`: pass 55 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 55건 통과, 0건 실패
- 실패 항목: 없음
