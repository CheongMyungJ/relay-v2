## 리뷰 지적
1. [사소] test/credit-note.test.js — 영세율(zeroRated) 반품 전표의 부가세 0을 확인하는 테스트가 없다. 코드(`creditTotals`의 `note.zeroRated ? 0`)는 맞고 면세 줄은 기존 테스트(36행)가 다룬다. 영세율 테스트 추가를 제안한다.

그 밖에 원인(합계 반올림)과 수정(줄별 버림 합)이 일치하고, 비목표(청구서·견적서, `src/format/`, 저장된 totals)는 건드리지 않았다.

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 고름)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 회계팀 계산과 어긋나지 않는다 | 통과 | INV-2047을 createInvoice→issueInvoice 후 CN-0112로 createCreditNote 실행: totals `{supply:17438, vat:1742, total:19180}`. 회계팀 기대값(1,742 / 19,180)과 일치 |
| `npm test`가 통과한다 | 통과 | `npm test`: 50개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff b5e9d71`에서 테스트 파일은 추가만 있고 기존 줄 변경·삭제 없음 |
| 반품 전표의 부가세와 합계가 회계팀 규정과 일치함을 보이는 테스트가 있다 | 통과 | test/credit-note.test.js "반품 전표 부가세는 줄마다 원 단위 버림으로 구해 합산한다 (CN-0112)"가 vat 1742, total 19180을 단언하고 통과 |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 재계산 없이 저장된 값을 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 추가 테스트가 `strictEqual`로 확인하고 통과 |
| `src/format/` 아래 파일이 변경되지 않는다 | 통과 | `git diff b5e9d71 --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 2개를 끝에 추가했을 뿐 기존 테스트는 바뀌지 않았다.

## 남은 위험
- 앞 Work(w-20261004-001)에서 `src/invoice/total.js`에 `lineVat`/`sumLineVat`을 고쳤을 수 있다(머지 대기). 머지 뒤 credit-note.js의 같은 이름 함수는 중복이 되므로 공유 코드로 바꿔야 할 수 있다.
- 영세율 반품 전표를 직접 확인하는 테스트가 없다 (지적 1).
- 비율 할인의 반올림(`percentOf`)은 규정에 없어 그대로 뒀다.
