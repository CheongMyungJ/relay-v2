## 리뷰 지적
1. [사소] src/invoice/credit-note.js:91 — `vat` 식이 한 줄에 `sumWon(filter(map(Math.floor ...)))`로 길게 겹쳐 있다. 변수로 나누면 읽기 쉽다.
2. [사소] test/credit-note.test.js (영세율/면세 테스트) — `mixed`는 면세 줄만 있는 전표라 이름이 오해를 부른다. 과세+면세 혼합 전표에서 면세가 부가세에서 빠지는지는 기존 '반품 전표 만들기'(vat 580)가 확인한다.

차단·권장 지적은 없다. 수정은 청구서 계산(`total.js`)과 `src/format/`을 건드리지 않았고, 원인(과세분 합에 한 번 반올림)을 직접 고쳤다.

## 반영
없음 (사람이 반영하지 않기로 함)

## 반영하지 않은 지적
- 1, 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (examples/CN-0112.json을 INV-2047에 적용한 환불 금액이 제약의 규칙대로 계산된다) | 통과 | `createCreditNote(INV-2047, CN-0112).totals`를 직접 실행: `{supply:17438, taxable:17438, exempt:0, vat:1742, total:19180}`. 줄별 923+612+207=1742. 수정 전(fix.md)은 1744/19182 |
| `npm test`가 통과한다 | 통과 | `npm test` → 49 pass / 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 0c89531`: 테스트 파일은 `test/credit-note.test.js`만 바뀌었고 추가만 있다(삭제·수정된 단언 없음) |
| 이미 `totals`가 저장된 반품 전표는 `creditNoteTotals`가 저장된 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`(변경 없음). 새 테스트 '저장된 totals가 있으면 ...'가 확인, npm test 통과 |
| `src/format/`의 출력 형식 테스트 결과가 그대로다 | 통과 | `git diff 0c89531 -- src/format`이 비어 있음. `test/format.test.js`, `invoice-text.test.js` 포함 npm test 전부 통과 |
| 면세 줄은 부가세에서 제외되고, `zeroRated` 반품 전표의 부가세는 0인 것을 테스트가 확인한다 | 통과 | 새 테스트 '영세율 반품 전표의 부가세는 0, 면세 줄은 부가세에서 제외'(영세율 vat 0, 면세 줄만 vat 0)와 기존 '반품 전표 만들기'(과세+면세 혼합, vat 580)가 확인 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 3개와 `readFileSync` import만 추가했고 기존 테스트는 그대로다. CN-0112 테스트는 수정 전 코드에서 실패한다(fix.md의 수정 전 결과).

## 남은 위험
- 회계팀 계산이 줄별 버림 규칙과 같다는 가정이다(기대 합계 19,180). 회계팀 수치로 직접 확인하지 않았다.
- 비율 할인 반올림(`percentOf`, 322.5→323)이 회계팀 방식과 다를 수 있으나 확인하지 않았다. 규칙 문서가 정하지 않아 바꾸지 않았다.
- 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: `creditTotals` 줄별 버림. 머지 시 충돌 가능.
- 이 브랜치의 청구서 계산 `src/invoice/total.js`는 비목표라 건드리지 않았다.
