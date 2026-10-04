## 리뷰 지적
1. [사소] src/invoice/total.js:31, src/invoice/credit-note.js:91 — 과세 줄 filter와 `lineVat` 합산이 두 곳에 같은 모양으로 있다. 필요하면 공용 함수로 묶을 수 있다.
2. [사소] src/invoice/credit-note.js:91 — 일부 수량 반품은 반품 줄 공급가액에 따로 버림하므로 반품 부가세 합이 원 청구서 줄 부가세와 1원 어긋날 수 있다. 회계 규칙 확인이 필요하다(현재 동작을 고정하는 테스트 없음).
3. [사소] test/credit-note.test.js — 영세율 반품 전표와 부분 반품의 부가세를 확인하는 테스트가 없다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2, 3 (사람이 "반영하지 않음"을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `examples/INV-2031.json`을 `createInvoice`→`computeTotals`로 직접 실행: vat 2641, total 29079 (수정 전 2644 / 29082) |
| `npm test`가 통과한다 | 통과 | `npm test`: 49 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff eac8dc2` 기준 테스트 파일은 추가만 있고 기존 줄 삭제·수정 없음 |
| `computeTotals`가 INV-2031에서 vat 2,641원, total 29,079원을 돌려주는 테스트가 있다 | 통과 | test/total.test.js "부가세는 과세 품목별로 ... (INV-2031)"가 supply 26438, vat 2641, total 29079를 단언하고 통과 |
| 이미 발행된 청구서는 저장된 합계를 그대로 쓰고 다시 계산되지 않는다 | 통과 | `invoiceTotals`(invoice.js:40)와 `creditNoteTotals`는 저장 합계를 우선 사용하며 이번 변경이 건드리지 않음. test/invoice.test.js:29, 39 통과 |
| `src/format/` 파일이 바뀌지 않는다 | 통과 | `git diff eac8dc2 --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 새 테스트 2개만 추가했고 기존 테스트는 그대로다
- test/credit-note.test.js — 약화 아님 — 전량 반품 부가세 테스트 1개만 추가했고 기존 테스트는 그대로다

## 남은 위험
- 일부 수량 반품의 부가세는 반품 줄 기준으로 버림해 원 청구서와 1원 차이가 날 수 있다 (지적 2).
- 공급가액이 음수인 줄은 없다고 가정한다 (`Math.floor`).
- 반품 전표 수정은 intent 범위를 넓힌 것이다. 기존 전표는 저장 합계를 쓰므로 영향 없다.
