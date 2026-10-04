## 리뷰 지적
1. [사소] test/credit-note.test.js:86 — `readFile`을 테스트 안에서 동적 import한다. 파일 맨 위 정적 import로 옮기기를 제안한다. 동작에는 영향 없다.

(그 밖에 의도의 비목표 위반, 원인과 어긋난 수정, 빠진 경계 조건은 찾지 못함. 원인인 `creditTotals`의 합계 반올림을 직접 고쳤고 증상만 가린 것이 아니다.)

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 회계팀 계산과 어긋나지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112)` 직접 실행: `{supply:17438, taxable:17438, exempt:0, vat:1742, total:19180}` (수정 전 1,744 / 19,182). 기준은 규칙으로 계산한 값이며 회계팀 실제 금액은 요청에 없음 |
| `npm test`가 통과한다 | 통과 | `npm test`: 49개 중 pass 49, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f3de686 -- test`: 기존 줄 변경 없이 테스트 3개만 추가 |
| 반품 전표의 부가세가 줄마다 할인된 줄 금액에 매겨 원 단위로 버림한 값의 합이다 | 통과 | `src/invoice/credit-note.js:92` 줄별 `lineVat`(net에 `Math.floor`)의 합. CN-0112 923+612+207=1,742 |
| 면세 줄과 영세율 반품 전표의 부가세는 0이다 | 통과 | `lineVat`이 `!taxable \|\| zeroRated`이면 0. 테스트 "영세율과 면세 줄은 0" 통과 |
| 저장된 `totals`가 있는 반품 전표는 다시 계산하지 않고 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`(변경 없음). 테스트 "저장된 totals가 있으면…" 통과 |
| `src/format/` 아래 파일은 변경되지 않는다 | 통과 | `git diff f3de686 --name-only -- src/format` 출력 없음 |
| CN-0112의 새 환불 합계를 검증하는 테스트가 추가된다 | 통과 | `test/credit-note.test.js` "CN-0112: …"가 totals 전체(vat 1742, total 19180)를 검증, 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 3개 추가만 있고 기존 테스트와 단언은 그대로다. fix.md에 따르면 수정 전에는 CN-0112 테스트가 실패했다.

## 남은 위험
- 청구서 `computeTotals`는 여전히 합계 반올림을 쓴다(비목표라 유지). 팀 규칙과 어긋난 채로 남아 있다.
- 앞 Work(w-20261004-001)에서 `lineVat`을 이미 고쳤을 수 있음, 머지 대기. 머지 때 `src/invoice/total.js`에서 충돌할 수 있다.
- 회계팀의 실제 기대 금액은 확인하지 못했다. 규칙으로 계산한 값을 기준으로 삼았다.
