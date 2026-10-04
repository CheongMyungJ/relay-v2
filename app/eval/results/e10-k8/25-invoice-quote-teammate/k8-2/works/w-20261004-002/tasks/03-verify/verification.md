## 리뷰 지적
1. [권장] test/credit-note.test.js — `lineVatSum`의 면세 줄·영세율·할인 줄 케이스 테스트가 없음(CN-0112는 과세 3줄뿐). 도우미 단위 테스트와 면세·할인 반품 테스트를 추가하자.
2. [사소] src/invoice/total.js:34 — `Math.floor`가 음수 net에서는 0 반대 방향으로 내려간다. 현재 net은 항상 0 이상이라 조치 불필요.

리뷰 결과: 변경은 목표와 비목표에 맞고, 원인(전체 한 번 반올림)을 직접 고쳤다. `src/format/`과 저장된 `totals` 경로는 그대로다.

## 반영
- 1 — `lineVatSum` 단위 테스트(줄마다 버림 1005+1005 → 200, 영세율 0, 면세 줄 제외)와 반품 전표 테스트(면세만 반품 → 0, 할인 줄 → 189) 추가. 커밋 fe1c172. `npm test` 51건 통과. 재현 절차는 바뀌지 않음.
- 지식: docs/knowledge/invoice/vat-per-line-floor.md를 같은 경로에서 고침(CN-0112 예, 아직 따르지 않는 곳) 후 커밋.

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(CN-0112 생성 후 환불 합계 확인)가 더 이상 실패하지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals` 직접 실행 → `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. fix.md의 수정 전 값은 19182 |
| `npm test`가 통과한다 | 통과 | `npm test` 51건 통과, 0건 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기존 테스트 변경 없이 import 한 줄과 테스트만 추가 |
| CN-0112의 환불 합계가 회계팀이 계산한 19,180원이다 | 통과 | 위 재현 실행 결과 total 19180 |
| 이미 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 저장된 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 회귀 테스트가 저장값 19182를 그대로 돌려받는지 확인 |
| `src/format/` 아래 파일이 바뀌지 않는다 | 통과 | `git diff 8384d2e --stat -- src/format` 출력 없음 |
| 위 사례를 덮는 회귀 테스트가 `test/credit-note.test.js`에 추가된다 | 통과 | '부가세는 줄마다 버림한 합이다 (CN-0112)' 추가. 수정 전 코드에서 실패(19182 ≠ 19180)한다고 fix.md에 기록됨. 이번에 수정 전 코드로 다시 돌려 보지는 않았다 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 기존 테스트는 그대로이고 import와 새 테스트만 추가됨

## 남은 위험
- `computeTotals`(청구서)와 `quoteTotals`(견적)는 아직 한 번 반올림이라 반품 전표와 규칙이 다르다(비목표). 지식 항목에 "아직 따르지 않는 곳"으로 기록함.
- 앞 Work(w-20261004-001)에서 `lineVatSum`을 이미 고쳤을 수 있음, 머지 대기: total.js 충돌 가능.
