## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(examples/CN-0112.json을 examples/INV-2047.json 청구서에 반품으로 적용)가 더 이상 회계팀 계산과 어긋나지 않는다 | 통과 | `createCreditNote`로 직접 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. 줄별 923+612+207=1742. 수정 전 값은 19,182원(fix.md) |
| `npm test`가 통과한다 | 통과 | `npm test` → 48개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff eac8dc2`: 테스트 파일은 추가만 있고 삭제·수정된 기존 단언 없음 |
| 반품 전표의 부가세가 과세 품목 줄마다 할인 적용 후 공급가액의 10%를 원 단위로 버림해 합산한 값이다 | 통과 | `creditTotals`가 `sumWon(rows.map(lineVat))`, `lineVat`은 `Math.floor(net*10/100)` (src/invoice/total.js:17-20). CN-0112 실행 결과 1742 |
| 면세 품목과 영세율 청구서의 반품 전표는 부가세가 0이다 | 통과 | `lineVat`이 `zeroRated \|\| !taxable`이면 0. 추가 테스트 '면세 줄과 영세율은 0'이 `npm test`에서 통과 |
| 저장된 `totals`가 있는 전표는 `creditNoteTotals`가 다시 계산하지 않고 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. `creditNoteTotals({totals:{vat:1}})` → `{ vat: 1 }` 실행 확인 |
| `src/format/`의 출력 형식 관련 기존 테스트가 그대로 통과한다 | 통과 | `src/format/`은 변경 없음. format.test.js, invoice-text.test.js 포함 `npm test` 전체 통과 |
| 이 버그를 재현하는 테스트가 추가된다 | 통과 | test/credit-note.test.js에 CN-0112 테스트 추가. fix.md상 수정 전 실패(47/1), 수정 후 통과. 이번에 수정 후 통과를 다시 확인 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 2개를 끝에 추가했을 뿐 기존 테스트와 단언은 그대로다

## 남은 위험
- `computeTotals`(청구서)는 비목표라 아직 `Math.round` 합계 기준이다. 같은 규칙이 청구서에는 적용되지 않는다
- 금액 할인의 부분 반품 분할(`returnedDiscount`)은 `Math.round` 그대로이고 규칙이 정해지지 않았다
- 앞 Work(w-20261004-001)에서 `lineVat`을 만들고 `computeTotals`를 고쳤을 수 있음, 머지 대기. 머지 때 src/invoice/total.js의 `lineVat`이 충돌할 수 있어 하나로 합쳐야 한다
