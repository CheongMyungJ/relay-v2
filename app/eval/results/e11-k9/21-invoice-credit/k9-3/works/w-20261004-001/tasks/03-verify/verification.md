## 리뷰 지적
없음

(확인한 것: 변경은 `src/invoice/total.js`의 vat 계산뿐이라 비목표에 맞다. 원인인 합계 기준 반올림을 줄별 floor 합산으로 고쳤고 증상만 가린 것이 아니다. 영세율·면세·할인 처리와 발행분 저장 합계 경로는 그대로다.)

## 반영
- 사람 요청(리뷰 지적 아님, 범위 확장) — `src/invoice/credit-note.js` `creditTotals`의 부가세를 청구서와 같은 줄별 floor 합산으로 고침. 테스트 2개 추가(test/credit-note.test.js). 커밋 a0bf63b. `npm test`: 50개 통과, 0개 실패. credit-note.js 변경만 되돌리면 새 테스트 1개가 실패함을 확인. 재현 절차(INV-2031)는 바뀌지 않음.
- 예: `examples/CN-0112.json`(INV-2047 발행 기준) 부가세 1,744 → 1,742원, 돌려주는 합계 19,182 → 19,180원 (공급가액 17,438원).

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`examples/INV-2031.json`의 합계가 29,079원) | 통과 | `createInvoice(INV-2031.json)` 후 `invoiceTotals` 실행: vat 2641, total 29079. 수정 전 `total.js`로 바꿔 돌리면 29082, 그 뒤 원복 |
| `npm test`가 통과한다 | 통과 | `npm test`: 48개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f23573e`: test/total.test.js에 테스트 2개 추가만 있고 기존 줄 변경·삭제 없음 |
| 부가세가 과세 줄마다 원 단위 버림으로 계산되어 합산되는 것을 테스트가 검증한다 | 통과 | test/total.test.js "부가세는 과세 줄마다 원 단위 버림 후 합산한다 (INV-2031)": vat 2641, total 29079 확인. 수정 전 코드에서는 실패(fix.md) |
| 할인이 있는 줄은 할인된 금액 기준으로 부가세가 계산되는 것을 테스트가 검증한다 | 통과 | test/total.test.js "부가세는 할인된 줄 금액에 줄마다 버림으로 계산한다": 금액·비율 할인 줄, vat 190 |
| 면세 줄과 영세율 청구서(`zeroRated`)의 부가세는 계속 0이다 | 통과 | 위 할인 테스트의 면세 줄은 vat에 불포함. test/invoice.test.js:56-60 영세율 vat 0, test/invoice-text.test.js:61 모두 `npm test`에서 통과 |
| 이미 발행된 청구서의 저장된 합계는 바뀌지 않는다 | 통과 | `invoiceTotals`는 발행분이면 저장된 `totals`를 반환(src/invoice/invoice.js:41). test/invoice.test.js:29, 39가 `npm test`에서 통과. 이번 변경으로 이 경로는 안 바뀜 |
| `src/format/` 파일은 변경되지 않는다 | 통과 | `git diff f23573e --name-only`: src/format/ 파일 없음 (src/invoice/total.js, credit-note.js, 테스트 2개, docs/knowledge 2개) |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 끝에 테스트 2개를 추가했을 뿐 기존 테스트와 단언은 그대로다
- test/credit-note.test.js — 약화 아님 — 끝에 테스트 2개를 추가했을 뿐 기존 테스트와 단언은 그대로다

## 남은 위험
- 사람 요청으로 intent 비목표("합계 계산(`src/invoice/total.js`) 외의 수정은 하지 않는다")를 넘어 credit-note.js도 고쳤다. intent는 갱신되지 않았다.
- 이미 저장된 반품 전표(`totals` 저장분)는 그대로이고, 새로 만드는 전표만 새 규칙이다. 기존 전표 부가세와 청구서가 어긋난 건은 그대로 남는다.
- draft 상태나 아직 발행되지 않은 청구서의 합계는 새 규칙으로 바뀐다.
- 발행분 저장 합계가 안 바뀌는 것을 직접 겨냥한 새 테스트는 없다(기존 invoice.test.js가 간접 검증).
