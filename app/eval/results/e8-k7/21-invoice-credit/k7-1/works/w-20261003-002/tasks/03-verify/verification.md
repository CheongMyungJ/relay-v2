## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | INV-2047/CN-0112로 `createCreditNote(...).totals`를 직접 다시 실행: `{ supply: 17438, vat: 1742, total: 19180 }` (수정 전 1744/19182) |
| `npm test`가 통과한다 | 통과 | `npm test` 47개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 5b88dd2`에서 test/credit-note.test.js는 import 한 줄과 테스트 1개 추가뿐, 삭제·수정 없음 |
| 반품 전표 부가세가 줄별 원 단위 버림의 합으로 계산됨을 확인하는 테스트가 있다 | 통과 | test/credit-note.test.js "반품 전표 부가세는 과세 줄마다 원 단위 버림의 합이다": CN-0112 1,742/19,180, 면세 0, 영세율 0 검증. 수정 전 실패(vat 1744)는 fix.md 기록과 코드 비교로 확인 |
| 이미 저장된 totals가 있는 반품 전표는 `creditNoteTotals`가 저장된 금액을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 변경 없음(`note.totals ?? creditTotals(note)`), 기존 테스트(test/credit-note.test.js:79)가 저장 금액 3189 반환을 확인하며 통과 |
| `src/format/`의 출력 형식 테스트 결과가 달라지지 않는다 | 통과 | src/format/ 변경 없음(diff에 없음), `npm test` 전체 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 기존 테스트는 그대로, 새 테스트와 readFileSync import만 추가

## 남은 위험
- 요청에 회계팀 금액이 없어 팀 규칙(줄별 버림)을 회계팀 계산으로 가정했다.
- returnedDiscount의 금액 할인 Math.round가 회계팀 계산과 같은지는 확인하지 않았다(비목표).
- 앞 Work(w-20261003-001)에서 computeTotals를 고쳤을 수 있음, 머지 대기. 이 브랜치의 computeTotals는 아직 Math.round.
