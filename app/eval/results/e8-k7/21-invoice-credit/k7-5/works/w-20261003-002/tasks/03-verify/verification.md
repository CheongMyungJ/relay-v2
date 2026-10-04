## 리뷰 지적
1. [사소] test/credit-note.test.js:85 — 새 테스트가 함수 안에서 동적 import로 fs를 읽는다. 파일 맨 위 import로 옮기면 읽기 쉽다.
2. [사소] test/credit-note.test.js — 영세율(zeroRated) 반품이 부가세 0이 되는 경로를 직접 확인하는 테스트가 없다.

차단·권장 지적은 없다. 변경(`src/invoice/credit-note.js`의 `creditTotals`)은 fix.md의 원인(과세 합계에 한 번 `Math.round`)을 고치며 증상만 가리지 않는다. 저장된 `totals`를 읽는 `creditNoteTotals`, `returnedDiscount`, `src/format/`은 건드리지 않았다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (CN-0112 요청을 새로 계산한 환불 합계가 규칙대로 계산한 값과 같다) | 통과 | `createCreditNote(INV-2047, CN-0112).totals` 직접 실행 → `{supply:17438, taxable:17438, exempt:0, vat:1742, total:19180}`. 줄별 9236/6127/2075 → 923+612+207=1742, 합계 19,180원으로 규칙값과 같다. 수정 전 값은 1744/19182 (fix.md). |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 47, pass 47, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff e5a926d -- test`에 삭제된 줄 없음, 테스트 1개 추가만 있음 |
| 반품 전표의 부가세가 과세 줄마다 `floor(할인 후 공급가액 × 10 / 100)`을 구해 합한 값이다 | 통과 | `credit-note.js` `creditTotals`가 과세 줄의 `Math.floor((net × VAT_RATE_PERCENT)/100)` 합을 쓴다(영세율 0, 면세 줄 제외). CN-0112 실행 결과 1742, 재현 테스트와 기존 혼합 테스트(vat 580) 통과 |
| 저장된 `totals`가 있는 반품 전표와 청구서는 `creditNoteTotals` 등으로 읽을 때 저장된 금액이 그대로 나온다 | 통과 | `creditNoteTotals`는 변경 없음(`note.totals ?? creditTotals(note)`). 기존 테스트(test/credit-note.test.js:77-78, 저장 total 3189 그대로)가 통과. 청구서 쪽 코드는 변경 없음 |
| `src/format/` 아래 파일은 변경되지 않는다 | 통과 | `git diff e5a926d --name-only` → `src/invoice/credit-note.js`, `test/credit-note.test.js`만 나옴 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — CN-0112 재현 테스트 1개만 추가했고 기존 줄은 지우거나 바꾸지 않았다. 수정 전 코드에서는 vat 1744로 실패하는 테스트다(fix.md).

## 남은 위험
- 영세율 반품의 부가세 0 경로와 줄별 버림이 여러 줄에서 갈리는 다른 조합은 이 변경의 테스트가 직접 다루지 않는다(지적 2).
- 부분 반품의 금액 할인은 수량 비율 반올림(`returnedDiscount`) 그대로라 줄별 규칙과 1원 차이가 날 수 있다. 규칙에 지정이 없어 범위 밖으로 두었다.
- `src/invoice/total.js`의 `computeTotals`도 같은 `Math.round` 방식일 수 있다. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기.
- 이미 만든 반품 전표의 저장 합계는 바뀌지 않으므로 새 계산값과 몇 원 다른 것은 의도된 것이다.
