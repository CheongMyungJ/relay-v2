## 리뷰 지적
1. [권장] test/money.test.js — 공용 `vatOfLines`의 단위 테스트가 없다. 영세율, 면세 줄 제외, 줄별 버림을 직접 확인하는 테스트를 추가할 것을 제안한다.
2. [사소] test/credit-note.test.js:85 — 테스트 안에서 `await import('node:fs')`를 동적으로 부른다. 파일 상단 import가 읽기 쉽다.

(원인 일치: `creditTotals`의 합계 반올림을 줄별 버림 합산으로 바꾼 것은 fix.md의 원인과 맞고 증상만 가린 것이 아니다. 비목표인 청구서·견적, `src/format/`은 건드리지 않았다.)

## 반영
- 1 — `test/money.test.js`에 `vatOfLines` 테스트 추가(줄별 버림 923+612+207, 면세 제외, 영세율 0, 빈 배열 0). 커밋 f5f662c. `npm test` → 51 통과, 0 실패. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 2 (사람이 "차단·권장만 반영"을 골라 제외)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(CN-0112 / INV-2047)가 더 이상 실패하지 않는다: 환불 합계가 회계팀 규정대로 계산한 값과 같다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals`를 직접 실행: vat 1742, total 19180 (줄별 923+612+207). 수정 전 19182. fix.md에서 재현됨 |
| `npm test`가 통과한다 | 통과 | `npm test` → 51 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 0f7ac95 -- test`는 추가만 있고 기존 줄 변경·삭제 없음 |
| 이미 저장된 `totals`가 있는 반품 전표와 청구서는 `creditNoteTotals` 등에서 재계산 없이 저장된 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 기존 테스트 test/credit-note.test.js:78 통과. 청구서 계산은 변경 없음 |
| `src/format/`의 출력 형식 테스트 결과가 달라지지 않는다 | 통과 | `src/format/` 변경 없음, test/format.test.js 포함 `npm test` 전부 통과 |
| 영세율 반품 전표는 부가세 0, 면세 줄은 부가세에 포함되지 않는다는 점이 테스트로 확인된다 | 통과 | test/credit-note.test.js의 "영세율 반품 전표는 부가세 0…" 테스트와 test/money.test.js의 `vatOfLines` 테스트가 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 2개 추가만 있고 기존 테스트는 그대로
- test/money.test.js — 약화 아님 — import에 `vatOfLines` 추가와 테스트 1개 추가만 있음

## 남은 위험
- 앞 Work(w-20261004-001)에서 `vatOfLines`를 이미 만들었을 수 있음(머지 대기). 머지 때 `src/money.js` 충돌과 시그니처 차이 가능
- 청구서(`total.js`)와 견적(`quote.js`)은 아직 옛 반올림 방식일 수 있음(앞 Work에서 고쳤을 수 있음, 머지 대기). 비목표라 건드리지 않음
- `returnedDiscount`의 `Math.round`(금액 할인 안분)는 규정 확인 없이 그대로 둠
