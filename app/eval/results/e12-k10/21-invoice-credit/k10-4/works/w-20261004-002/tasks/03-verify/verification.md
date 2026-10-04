## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(CN-0112를 INV-2047에 적용)가 더 이상 실패하지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals` 직접 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. 수정 전 19182 |
| `npm test`가 통과한다 | 통과 | `npm test`: tests 48, pass 48, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 80b49e1`: 테스트 파일은 `test/credit-note.test.js`에 추가만 있고 삭제·수정한 기존 줄 없음 |
| 반품 전표의 부가세가 과세 줄마다 버림한 합이다 | 통과 | `creditTotals`가 `sumLineVat`(줄별 `Math.floor`) 사용. 줄 923+612+207=1742 |
| 줄 단위 합산 규칙을 쓰고, 이 사례 확인 테스트가 추가된다 | 통과 | 합계 반올림 제거. `test/credit-note.test.js`에 CN-0112 테스트와 영세율/면세 테스트 추가, npm test에서 통과 |
| `src/format/` 출력 형식 그대로, `test/format.test.js`·`test/invoice-text.test.js` 수정 없이 통과 | 통과 | `git diff 80b49e1 --stat`에 `src/format/`과 두 테스트 없음. npm test 전체 통과 |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 그 금액을 그대로 돌려준다 | 통과 | `creditNoteTotals`(`note.totals ?? creditTotals(note)`) 변경 없음. 기존 테스트 `creditNoteTotals(stored).total === 3189` 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 2건과 import 1줄만 추가, 기존 단언은 그대로

## 남은 위험
- 청구서 `computeTotals`(`src/invoice/total.js`)는 여전히 합계 반올림이다(비목표). 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 같은 파일에 `lineVat`/`sumLineVat`을 추가해 머지 충돌 가능
- 회계팀이 CN-0112 19,180원을 직접 확인하지는 않았다(규칙 계산값)
- 영세율 + 면세 조합의 경계는 간단한 테스트만 있다
