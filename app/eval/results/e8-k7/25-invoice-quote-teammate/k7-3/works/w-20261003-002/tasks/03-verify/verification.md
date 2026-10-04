## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(CN-0112를 INV-2047에서 만들었을 때 환불 합계가 회계팀 계산과 다른 것)가 더 이상 실패하지 않는다 | 통과 | fix.md의 재현 명령을 다시 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. 기대값(vat 1,742, 합계 19,180)과 일치. 이전 결과는 1,744/19,182 |
| `npm test`가 통과한다 | 통과 | `npm test` 직접 실행: 49 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 14cc49d`에서 test/credit-note.test.js는 import 한 줄과 테스트 하나만 추가됨. 기존 테스트 변경·삭제 없음 |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 그 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 기존 테스트(test/credit-note.test.js:78-79, 저장값 3189)가 통과 |
| `src/format/` 파일과 그 출력은 바뀌지 않는다 | 통과 | `git diff 14cc49d --stat -- src/format` 결과 비어 있음 |
| 반품 전표 부가세 계산 규칙을 확인하는 테스트가 추가된다(CN-0112 포함) | 통과 | 새 테스트 '반품 전표 부가세는 과세 줄마다 원 단위 버림의 합이다 (CN-0112)': vat 1742, 영세율 0, 면세 0 확인. 수정 전 코드에서는 vat 1744로 실패(fix.md), 지금은 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — import 한 줄과 새 테스트만 추가. 기존 단언은 그대로이고 새 테스트가 수정 전 코드를 잡아낸다

## 남은 위험
- 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 이 브랜치에는 `vatOfRows`가 없어 credit-note.js에 `vatOfNet`을 따로 뒀다. 머지 후 중복될 수 있다. 청구서·견적서(total.js `computeTotals`)는 이 브랜치에서 아직 합계 반올림이며 범위 밖이라 건드리지 않았다.
- 할인 반올림(`returnedDiscount`)은 바꾸지 않았다. 다른 사례에서 회계팀 값과 어긋나면 다시 볼 곳이다.
