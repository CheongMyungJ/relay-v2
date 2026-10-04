## 리뷰 지적
1. [사소] src/invoice/credit-note.js:91 — 과세 줄을 `rows.filter((r) => r.taxable)`로 한 줄 안에서 다시 걸러 길다. 과세 줄 목록을 변수로 빼면 읽기 쉽다.
2. [사소] test/credit-note.test.js (마지막 테스트) — '저장된 totals면 재계산하지 않는다' 테스트는 수정 전에도 통과한다. 수정을 잡는 테스트가 아니라 동결 규칙을 고정하는 보호용이다.
3. [사소] src/invoice/credit-note.js:91 — `Math.floor`는 net이 음수면 0에서 멀어지는 쪽으로 내린다. net이 음수인 줄(금액 할인이 공급가액보다 큰 경우)은 현재 입력 검증이 없다. 청구서도 같은 방식이라 이번 범위에서는 그대로 둔다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2, 3 (사람이 "반영하지 않음"을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals`를 직접 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }` (fix.md의 수정 전 19,182와 비교) |
| `npm test`가 통과한다 | 통과 | `npm test` → 49개 중 pass 49 / fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 9cf9491`: 테스트 파일은 import 1줄과 테스트 3개만 추가했고 기존 줄은 지우거나 바꾸지 않았다 |
| CN-0112 요청과 INV-2047로 `createCreditNote`를 호출하면 `totals.total`이 19,180이다 | 통과 | 위 재현 실행 결과 total 19180. 테스트 '반품 전표 부가세는 과세 줄마다 절사해 합산한다'도 통과 |
| 면세 줄이 있거나 `zeroRated`인 반품 전표의 부가세가 위 규칙대로 계산된다는 테스트가 있다 | 통과 | '반품 전표 부가세: 면세 줄은 없고 영세율이면 0': 면세 줄 포함 vat 62(줄별 31+31), zeroRated vat 0 확인. `npm test` 통과 |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 저장된 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`이고 변경하지 않았다. '저장된 totals가 있으면 ...' 테스트 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — import와 테스트 3개만 추가했고 기존 테스트는 그대로다

## 남은 위험
- 청구서 `computeTotals`(src/invoice/total.js)는 이 브랜치에서 아직 `Math.round`다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 비목표라 건드리지 않았다.
- net이 음수인 줄은 검증하지 않는다(지적 3).
- 팀 지식 docs/knowledge/invoice/ 두 파일을 이 브랜치에 새로 썼다. 앞 Work와 머지할 때 같은 경로에서 충돌할 수 있다.
