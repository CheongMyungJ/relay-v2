## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (CN-0112의 환불 금액이 줄별 버림 규칙의 값과 같다) | 통과 | `node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json` → vat 1742, total 19180 (공급가액 17438). 손계산 923+612+207=1,742와 같음 |
| `npm test`가 통과한다 | 통과 | `npm test` → 52 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 9c71fb2`에서 test/credit-note.test.js는 import 한 줄과 테스트 4개 추가뿐, 삭제·수정 없음 |
| 반품 전표의 부가세가 줄별 `Math.floor` 합이라는 것을 확인하는 테스트가 있다 | 통과 | "반품 전표의 부가세는 줄별 버림의 합이다 (CN-0112)". creditTotals를 옛 `Math.round` 방식으로 되돌리고 `npm test`를 돌리니 이 테스트가 실패(51 pass / 1 fail), 복구 후 통과 |
| 면세 줄이 섞인 전표와 영세율 전표의 부가세가 규칙대로(면세 0, 영세율 0) 계산된다 | 통과 | 면세 혼합(vat 435+567, exempt 18000), 영세율(vat 0) 테스트 통과. `lineVat`이 `!taxable \|\| zeroRated`이면 0 (src/invoice/vat.js:6-8) |
| 저장된 `totals`가 있는 전표는 `creditNoteTotals`가 다시 계산하지 않고 그대로 돌려준다 | 통과 | "저장된 totals가 있으면 다시 계산하지 않는다" 통과, `creditNoteTotals`는 `note.totals ?? creditTotals(note)` (credit-note.js:96) |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 기존 테스트 변경 없이 테스트 4개와 `readFileSync` import만 추가

## 남은 위험
- 면세 혼합·영세율·저장 totals 테스트는 수정 전에도 통과한다(회귀 방지용). 부가세 버림 자체를 잡는 것은 CN-0112 테스트 하나다
- `src/invoice/vat.js`는 앞 Work(w-20261004-001)가 만들었을 수 있어, 머지할 때 충돌할 수 있음
- 청구서(total.js)·견적서(quote.js)는 아직 `Math.round` 방식이며 비목표라 두었다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기
- 저장된 totals가 있는 기존 반품 전표는 재계산하지 않으므로 이미 발행된 전표는 그대로다(의도된 동작)
