## 리뷰 지적
1. [사소] test/credit-note.test.js — 반품 전표 부가세 테스트가 기본 케이스 하나뿐이다. 할인 줄, 면세 줄, 영세율 청구서의 반품 케이스 테스트를 추가하면 좋다.
2. [사소] src/invoice/total.js:16 — `lineVat`을 반품 전표도 쓰므로 credit-note.js가 total.js를 import한다. 순환은 없고 변경 불필요에 가깝다.

## 반영
- 1 — test/credit-note.test.js에 테스트 2개 추가 (할인 줄 + 면세 줄 반품, 영세율 청구서 반품). 커밋 78921e9. `npm test` 52 pass / 0 fail. 재현 절차는 바꾸지 않음.
- 지식 기록: docs/knowledge/accounting/vat-per-line-floor.md, docs/knowledge/invoice/issued-totals-are-stored.md (같은 커밋)

## 반영하지 않은 지적
- 2 (사람이 1번만 반영하기로 고름)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계 29,079원, 부가세 2,641원) | 통과 | `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079. fix.md의 수정 전 값(2,644 / 29,082)과 다름 |
| `npm test`가 통과한다 | 통과 | 직접 실행: 52 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f3de686 -- test`는 추가만 있고 기존 줄 변경·삭제 없음 |
| 부가세가 줄마다 원 단위 버림으로 계산되고 그 합이 청구서 부가세가 됨을 확인하는 테스트가 있다 | 통과 | test/total.test.js "부가세는 줄마다 원 단위 버림으로 계산해 합한다 (INV-2031)", test/credit-note.test.js 반품 전표 버림 테스트. 둘 다 통과 |
| 할인이 있는 줄은 할인된 줄 금액 기준으로 부가세가 계산됨을 확인하는 테스트가 있다 | 통과 | test/total.test.js "할인이 있는 줄은 …" (vat 373), test/credit-note.test.js 할인 줄 반품 테스트 (vat 378) |
| 영세율(`zeroRated`)과 면세 줄의 부가세는 기존처럼 0이다 | 통과 | `lineVat`이 면세·영세율이면 0을 돌려줌. test/total.test.js "면세 줄과 영세율 …", test/credit-note.test.js 영세율 반품 테스트 통과 |
| 발행된 청구서의 저장된 합계는 다시 계산되지 않고, `src/format/`은 변경되지 않는다 | 통과 | `git diff f3de686 -- src/format` 비어 있음. src/invoice/invoice.js:41, credit-note.js:97이 저장된 totals를 먼저 쓰는 것을 확인 (이 Work는 해당 코드를 바꾸지 않음) |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 새 테스트 3개만 추가, 기존 테스트는 그대로
- test/credit-note.test.js — 약화 아님 — 새 테스트 3개만 추가(fix 1개, verify 2개), 기존 테스트는 그대로

## 남은 위험
- 일부만 반품하면 반품 줄의 부가세를 다시 줄 단위로 버림하므로, 원 청구서 줄의 부가세를 수량 비율로 나눈 값과 1원 차이가 날 수 있다. 회계 규정상 맞는지는 확인하지 않았다.
- src/export/ 등은 저장된 totals의 vat를 읽을 뿐 다시 계산하지 않는다(grep 확인). 
- 이미 발행된 청구서와 반품 전표는 바뀌지 않고 초안 상태만 새 규칙으로 계산된다. 의도한 동작이다.
