## 리뷰 지적
1. [권장] src/invoice/credit-note.js:90 — 반품 전표 부가세가 합계 `Math.round`라 같은 줄을 청구서와 반품 전표로 계산하면 몇 원 어긋난다. 줄별 버림 합산으로 맞추기를 제안한다.
2. [권장] src/invoice/quote.js:42 — 견적 부가세가 할인 전 금액 기준이라 청구서와 합계가 달라진다. 할인 후 줄별 버림 합산을 제안한다.
3. [사소] src/invoice/total.js:31 — 과세 줄을 두 번 filter한다(가독성). 동작에는 영향 없다.

## 반영
- 1, 2 — 사람이 "차단·권장만 반영"을 골랐다. `creditTotals`와 `quoteTotals`의 부가세를 할인 후 과세 줄마다 `Math.floor` 후 합산으로 바꿨다(quote.js의 안 쓰는 `percentOf` import 제거). 각각 새 테스트를 추가했다. 커밋 bc008ff. `npm test` → 52개 통과, 0개 실패. 재현 절차는 바뀌지 않았다.

## 반영하지 않은 지적
- 3

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031을 계산하면 합계가 29,079원) | 통과 | `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079 |
| `npm test`가 통과한다 | 통과 | `npm test` → 52 pass / 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기존 테스트 수정·삭제 없음. 테스트 3개 파일에 새 테스트만 추가(`git diff 89e39a7`) |
| 줄별 부가세를 원 단위 버림으로 계산해 합산한 값이 부가세로 쓰인다는 테스트가 추가된다 | 통과 | test/total.test.js의 INV-2031 테스트(vat 2641)와 할인·면세 혼합 테스트(vat 22) |
| 이미 발행된 청구서(저장된 합계가 있는 것)는 저장된 합계를 그대로 쓰고 다시 계산하지 않는다 | 통과 | `invoiceTotals`(invoice.js:41) 변경 없음. test/invoice.test.js '발행된 청구서는 저장된 합계를 쓴다'(저장값 26894)가 통과 |
| `src/format/`의 출력은 수정 전과 같다 | 통과 | `git diff 89e39a7 --stat -- src/format` 변경 없음, format·invoice-text 테스트 통과. 다만 발행 전 초안을 찍으면 합계 값은 새 규칙을 따른다 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 새 테스트 2개만 추가, 기존 테스트 변경 없음
- test/quote.test.js — 약화 아님 — 새 테스트 1개만 추가
- test/credit-note.test.js — 약화 아님 — 새 테스트 1개만 추가

## 남은 위험
- 견적·반품 전표는 의도(청구서 합계) 밖인데 리뷰에서 사람이 골라 이번 Work에서 함께 바꿨다. 이미 저장된 견적·반품 전표 합계는 다시 계산하지 않아 옛 값이 남는다.
- 반품 전표 새 테스트는 전량 반품 경우만 본다. 부분 반품의 금액 할인 안분(`returnedDiscount`)은 바꾸지 않았다.
