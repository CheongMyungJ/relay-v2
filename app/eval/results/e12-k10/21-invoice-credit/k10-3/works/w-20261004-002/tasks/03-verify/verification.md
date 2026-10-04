## 리뷰 지적
1. [사소] test/credit-note.test.js:85-87 — 테스트 안에서 `node:fs`를 동적 import한다. 파일 상단 정적 import가 더 읽기 쉽다.
2. [사소] src/invoice/credit-note.js:90-93 — 과세 줄 필터(`rows.filter((r) => r.taxable)`)가 `taxable`과 `vat` 계산에서 두 번 나온다. 한 번 걸러 재사용할 수 있다.

(차단·권장 없음. 변경은 intent의 목표·비목표에 맞고, 원인인 합계 기준 `Math.round`를 줄별 `Math.floor` 합산으로 직접 고쳤다. 영세율 0, 면세 제외, 저장된 `totals` 사용은 유지된다.)

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택. 둘 다 사소하고 동작과 무관)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (CN-0112 환불 합계가 19,180원) | 통과 | `createCreditNote(INV-2047, CN-0112).totals`를 직접 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. 수정 전 19,182원(fix.md)과 비교 |
| `npm test`가 통과한다 | 통과 | `npm test` → 48개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 55ac230`: 테스트 파일은 추가만 있고 기존 테스트 수정·삭제 없음 |
| 반품 전표의 부가세는 과세 줄마다 할인 후 금액에 원 단위 버림으로 계산한 값의 합이고, 합계는 공급가액 합 + 부가세 합이다 (테스트로 확인) | 통과 | `src/invoice/credit-note.js:90-93`. `test/credit-note.test.js`의 새 테스트 2개가 CN-0112(vat 1742)와 줄별 버림 합 813, total = supply + vat을 확인하고 통과 |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 다시 계산하지 않고 저장된 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 변경 없음(`note.totals ?? creditTotals(note)`). 새 테스트가 저장값 total 2를 그대로 돌려주는지 확인하고 통과 |
| `src/format/`의 출력은 바뀌지 않는다 (`test/format.test.js`, `test/invoice-text.test.js` 통과) | 통과 | `git diff --stat`에 `src/format/` 없음. `node --test test/format.test.js test/invoice-text.test.js` → pass 8, fail 0 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 2개만 추가했고 기존 테스트는 그대로다.

## 남은 위험
- 청구서 `src/invoice/total.js`는 이 브랜치에서 아직 `Math.round`다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 비목표라 건드리지 않았다.
- 줄별 할인 반올림(`returnedDiscount`의 금액 할인 `Math.round`)은 회계팀 규칙을 확인하지 않았다. CN-0112에서는 맞는다.
- 보조 테스트는 수정 전에도 통과한다. 수정을 가르는 테스트는 CN-0112 하나다.
