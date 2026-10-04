## 리뷰 지적
1. [사소] test/total.test.js:4, test/credit-note.test.js:4 — `node:fs` import가 로컬 import 사이에 끼어 있다. `node:` import를 위쪽 묶음에 두면 일관된다.
2. [사소] src/invoice/total.js:31, src/invoice/credit-note.js:91 — "과세 줄의 `lineVat` 합산" 식이 두 곳에 중복된다. 헬퍼로 합치면 규정이 한 곳에 남는다. 동작은 같다.

목표·비목표 적합, 원인(합계 단위 반올림, `total.js`와 `credit-note.js` 두 곳) 해결, 발행본 저장 합계 경로(`invoiceTotals`, `creditNoteTotals`) 미변경, `src/format/` 미변경을 확인했다. 차단·권장 지적은 없다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `createInvoice(INV-2031)`→`computeTotals`를 직접 실행: vat 2641, total 29079 |
| `npm test`가 통과한다 | 통과 | `npm test`: 50 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff a313ffc`에서 테스트 파일은 추가만 있고 기존 줄 삭제·수정 없음 |
| INV-2031 부가세 2,641원, 합계 29,079원 확인 테스트 | 통과 | test/total.test.js "부가세는 줄마다 … (INV-2031)"가 vat 2641, total 29079를 단언하고 통과 |
| 영세율 청구서 부가세 0원 | 통과 | test/total.test.js "영세율은 …"에서 zeroRated vat 0 통과 |
| 면세 줄은 계속 제외 | 통과 | 같은 테스트에서 면세 줄 포함 시 vat 536(과세 줄만), 기존 면세 테스트도 통과 |
| CN-0112 부가세가 줄별 버림 합, 재반올림 없음 확인 테스트 | 통과 | test/credit-note.test.js CN-0112 테스트가 vat 923+612+207=1742, total 19180 단언. 직접 실행 결과 동일 |
| 반품 전표 영세율 0원, 면세 줄 제외 유지 | 통과 | test/credit-note.test.js "반품 전표의 영세율은 …" 통과 (zeroRated vat 0, 면세 제외 vat 435) |
| `src/format/` 아래 파일이 바뀌지 않는다 | 통과 | `git diff a313ffc --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트 2개 추가와 import 1줄 추가만 있고 기존 단언은 그대로다.
- test/credit-note.test.js — 약화 아님 — 테스트 2개 추가와 import 1줄 추가만 있고 기존 단언은 그대로다.

## 남은 위험
- 줄별 버림 규정은 반품 할인 안분(`returnedDiscount`)의 원 단위 반올림에는 적용하지 않았다. CN-0112 기대값은 줄별 버림 규정으로 직접 계산한 값이다.
- 이미 저장된 합계를 쓰는 경로는 테스트로 새로 확인하지 않았다(코드상 `invoiceTotals`, `creditNoteTotals` 미변경).
- `examples/INV-2031.json`은 taxType이 없어 `createInvoice`를 거쳐야 과세로 계산된다.
