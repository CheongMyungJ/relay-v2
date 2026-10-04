## 리뷰 지적
1. [사소] src/invoice/credit-note.js:90 — 주석이 `docs/knowledge/vat-per-line-floor.md`를 가리키지만 이 브랜치에는 그 파일이 없다(앞 Work 머지 대기). 경로를 빼고 규칙을 직접 적는 것을 제안.
2. [사소] test/credit-note.test.js:93 — '저장된 totals' 테스트는 수정 전에도 통과해 이번 수정을 잡지 못한다. 발행된 전표 보호용 회귀 테스트이므로 그대로 두되 이름에 목적을 밝히는 것을 제안.

## 반영
- 1, 2 (사람이 "모두 반영" 선택) — 주석에서 파일 경로를 빼고 "합계에서 다시 반올림하지 않는다"를 적음. 테스트 이름에 "(발행된 전표 보호)" 추가. 커밋 e4485a4. `npm test` 50개 통과, 0 실패. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다. 환불 합계가 19,180원이다 | 통과 | INV-2047/CN-0112로 `createCreditNote(...).totals`를 직접 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }` (수정 전 19,182) |
| `npm test`가 통과한다 | 통과 | `npm test` 50개 통과, 0 실패 (반영 커밋 뒤 다시 실행) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 270f5ae`: 테스트 파일은 import와 테스트 2개 추가, 이름 한 곳 변경뿐. 삭제·단언 완화 없음 |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 다시 계산하지 않고 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 추가 테스트가 같은 참조(`strictEqual`)를 확인하고 통과 |
| `src/format/` 아래 파일이 바뀌지 않고 기존 출력 테스트가 그대로 통과한다 | 통과 | `git diff 270f5ae --stat -- src/format` 출력 없음. `npm test` 전체 통과 |
| CN-0112의 환불 금액 회귀 테스트가 추가된다 | 통과 | `test/credit-note.test.js`의 'CN-0112 환불 금액…'. fix.md에 따르면 수정 전 실패(49/1)였고 지금 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 기존 테스트는 그대로, `readFileSync` import와 새 테스트 2개만 추가, 리뷰 반영으로 새 테스트 이름만 바꿈

## 남은 위험
- `src/invoice/total.js:26`(청구서)과 `src/invoice/quote.js:42`(견적서)는 여전히 합계 기준 반올림/할인 전 금액 방식. 비목표라 건드리지 않음. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기.
- 줄별 할인(`returnedDiscount`)의 `Math.round`는 유지. CN-0112 외 금액 할인 부분 반품 사례는 확인하지 않음.
