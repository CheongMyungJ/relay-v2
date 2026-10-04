## 리뷰 지적
1. [사소] test/credit-note.test.js:93 — CN-0112 테스트가 합계를 `notStrictEqual(total, 19182)`로만 확인했다. 기대 합계 19,180원을 직접 단언하도록 제안.

## 반영
- 1 — `assert.strictEqual(total, 19180)`으로 바꿨다. 커밋 4eb746a. `npm test`: 48개 통과, 0 실패. 재현 절차는 바뀌지 않았다.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 19,182원을 내지 않고, 부가세가 줄별 부가세(할인된 과세 줄 금액에 `Math.floor`)의 합이다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals`를 직접 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. 줄별 923+612+207=1,742. `creditTotals`는 `lineVat`(`Math.floor`)의 `sumWon` 합 |
| `npm test`가 통과한다 | 통과 | `npm test`: tests 48, pass 48, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2ea930a -- test`: 추가만 있고 기존 테스트 변경·삭제 없음 |
| 면세 줄과 영세율 반품 전표의 부가세는 0원이다 | 통과 | `lineVat`이 `zeroRated \|\| !taxable`이면 0. 테스트 '면세 줄과 영세율은 0원'이 통과(면세 줄 vat 0, 영세율 totals vat 0) |
| 반품 전표 부가세 계산용 테스트를 추가한다(CN-0112 사례 포함) | 통과 | `test/credit-note.test.js` 끝에 2개 추가(CN-0112, 면세·영세율). CN-0112 테스트는 fix.md 기준 수정 전 실패(1742 기대, 1744 실제), 수정 후 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — `readFileSync` import와 테스트 2개를 추가했을 뿐 기존 단언은 그대로다. 반영한 지적도 단언을 더 엄격하게 한 것이다.

## 남은 위험
- `computeTotals`(청구서)는 여전히 합계에 `Math.round` 한 번이다. 비목표라 건드리지 않았고, 이 브랜치에서는 청구서와 반품 전표의 부가세 방식이 다르다.
- 앞 Work(w-20261004-001)에서 `lineVat`을 이미 고쳤을 수 있음, 머지 대기. 머지 시 `src/invoice/total.js`의 `lineVat`이 충돌할 수 있어 하나로 합쳐야 한다.
- 회계팀 기대 금액(19,180원)은 요청에 없어 줄별 버림 규칙에서 추정한 값이다.
