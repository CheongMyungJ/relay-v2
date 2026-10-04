## 리뷰 지적
1. [사소] test/credit-note.test.js — 면세 줄이 섞인 전표와 영세율(zeroRated) 전표의 부가세를 확인하는 테스트가 없다. 코드는 규칙대로 동작한다(면세 줄은 제외, 영세율은 0). 테스트 2개 추가를 제안.

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 회계팀 기준과 어긋나지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112)` 직접 실행 → `{supply:17438, taxable:17438, exempt:0, vat:1742, total:19180}`. 수정 전 1,744/19,182 (fix.md). |
| `npm test`가 통과한다 | 통과 | `npm test` → 48 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 65eab07 -- test`는 추가만 있고 삭제·수정된 기존 단언 없음 |
| CN-0112의 환불 부가세와 합계가 회계팀 규칙으로 손계산한 값과 같다는 테스트가 있다 | 통과 | test/credit-note.test.js `CN-0112: 부가세는 줄마다 버림 후 합산한다`가 923+612+207=1742, 합계 19180을 단언. 통과 확인 |
| 저장된 `totals`가 있는 반품 전표와 발행된 청구서는 이전과 같은 금액을 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)` 그대로. 저장 totals 유지 테스트(저장 vat 291은 재계산값 290과 다름) 통과. 청구서 `src/invoice/total.js`는 변경 없음 |
| `src/format/` 아래 파일과 그 테스트 기대값이 바뀌지 않는다 | 통과 | `git diff 65eab07 --stat -- src/format test`에서 src/format 변경 없음 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — `readFileSync` import와 테스트 2개를 추가했을 뿐 기존 테스트·단언은 그대로다.

## 남은 위험
- 청구서 쪽(`src/invoice/total.js:26`)은 비목표라 합계 기준 `Math.round`가 그대로다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
- 면세 줄 혼합·영세율 전표의 부가세는 테스트로 직접 확인하지 않았다(지적 1).
- 줄 할인 반올림(`percentOf`)은 그대로 두었다. 회계팀 기준과 다른지는 확인되지 않았다.
