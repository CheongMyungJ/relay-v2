## 리뷰 지적
1. [사소] test/credit-note.test.js:88 — `examples/*.json`을 cwd 기준 상대경로로 읽어 레포 루트가 아닌 곳에서 실행하면 실패한다. `import.meta.url` 기준 경로를 제안. 다만 `npm test`는 루트에서 돌고 차단 사유는 아님.

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (CN-0112 환불 합계 19,180원) | 통과 | `createCreditNote(INV-2047, CN-0112).totals` 직접 실행 → `{supply:17438, taxable:17438, exempt:0, vat:1742, total:19180}`. 수정 전 값(1744/19182)은 fix.md 기록과 비교; 원인(합계 기준 `Math.round`)이 diff에서 제거됨 |
| `npm test`가 통과한다 | 통과 | `npm test` → 50개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff df88ab4 -- test`: 기존 테스트 변경 없이 테스트 2개와 import 1줄만 추가 |
| 반품 전표의 부가세는 과세 줄마다 (할인 반영 후 공급가액 × 부가세율)을 원 미만 절사해 합한 값이고, 합계에 다시 반올림하지 않는다 | 통과 | `credit-note.js` `creditTotals`가 `r.net`(할인 반영 후)에 `lineVat`(`Math.floor`)을 적용해 `sumWon`으로 합산. CN-0112 테스트가 1742를 확인 |
| 면세 줄은 부가세 계산에서 빠지고, 영세율 전표의 부가세는 0원이다 | 통과 | `rows.filter(r => r.taxable)`로 면세 제외, `zeroRated ? 0`. 영세율은 새 테스트가 확인. 면세 줄 제외는 코드 확인만 했고 전용 테스트는 없음(기존 테스트 통과) |
| 이미 저장된 `totals`가 있는 전표는 `creditNoteTotals`가 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 미변경. 새 테스트가 `assert.strictEqual(…, saved)`로 확인 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 기존 단언은 그대로 두고 CN-0112, 영세율, 저장 totals 테스트만 추가

## 남은 위험
- 청구서(`computeTotals`, total.js)와 견적서(`quote.js`)는 비목표라 여전히 합계 기준 반올림이다. 팀 지식상 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
- `lineVat`을 이 Work에서 새로 추가했다. 앞 Work에도 같은 이름이 있으면 머지 때 `src/invoice/total.js` 충돌 가능.
- 면세 줄만 있는 전표나 할인 포함 줄의 전용 테스트는 없다.
