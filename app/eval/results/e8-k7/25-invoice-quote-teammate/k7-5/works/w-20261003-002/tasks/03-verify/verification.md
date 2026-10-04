## 리뷰 지적
1. [사소] test/credit-note.test.js:87 — 새 테스트가 `examples/…`를 cwd 기준 상대 경로로 읽어, 레포 루트가 아닌 곳에서 실행하면 실패한다. `import.meta.url` 기준 경로를 제안.
2. [사소] test/credit-note.test.js:95 — '면세 줄은 부가세에서 제외한다'가 면세 단독이라 과세+면세 혼합에서의 제외를 직접 보지 못한다. 혼합 케이스(기존 37행 테스트가 일부 덮음) 추가를 제안.

모든 변경은 목표·비목표 안에 있고, 원인(과세 합계 한 번 반올림)을 줄별 버림 합산으로 직접 고쳤다. 증상만 가리는 수정이 아니다.

## 반영
없음 (사람이 반영하지 않음을 선택)

## 반영하지 않은 지적
- 1
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다. 환불 합계 19,180원 | 통과 | `createCreditNote(INV-2047, CN-0112).totals` 직접 실행 → `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }` |
| `npm test`가 통과한다 | 통과 | `npm test` → 50 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 973a500`: 테스트 파일은 import 1줄과 새 테스트 2개 추가뿐, 기존 단언 변경·삭제 없음 |
| 면세 줄은 제외되고 영세율 전표의 부가세는 0원 | 통과 | 새 테스트(zeroRated → vat 0, 면세 단독 vat 0)와 기존 혼합 테스트(vat 580)가 `npm test`에서 통과. 코드: 과세 줄만 합산, `zeroRated`면 0 |
| 저장된 `totals`가 있으면 `creditNoteTotals`가 재계산하지 않음 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 기존 테스트(78행, 저장 totals 우선)가 통과 |
| `src/format/` 아래 파일은 변경되지 않는다 | 통과 | `git diff 973a500 --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — `readFileSync` import와 새 테스트 2개(CN-0112 재현, 면세 줄) 추가만 했다. 기존 테스트는 그대로이고, 새 테스트는 수정 전 코드에서 실패(1,744원)함이 fix.md에 기록됨.

## 남은 위험
- 앞 Work(w-20261003-001)가 `lineVat`을 추가했을 수 있음(머지 대기). 머지 뒤 `creditTotals`를 `lineVat`으로 합칠 수 있다.
- 위 지적 1·2(사소)는 반영하지 않았다.
- 저장된 totals가 있는 기존 반품 전표는 재계산하지 않아 이전 금액 그대로다(의도대로).
