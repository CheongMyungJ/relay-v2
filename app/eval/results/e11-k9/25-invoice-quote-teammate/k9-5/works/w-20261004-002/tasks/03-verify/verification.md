## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (CN-0112의 환불 합계가 19,180원이다) | 통과 | INV-2047에 CN-0112를 `createCreditNote`로 적용해 출력: `{ supply: 17438, vat: 1742, total: 19180 }` |
| `npm test`가 통과한다 | 통과 | `npm test` → 49개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff e0852d8 -- test`는 추가만 있고 삭제·수정 줄이 없다 |
| 반품 전표의 부가세가 돌려받는 줄마다 원 단위 버림으로 계산한 값의 합이고, 합계에서 다시 반올림하지 않는 것을 확인하는 테스트가 있다 | 통과 | `test/credit-note.test.js` 마지막 테스트(vat 290). 수정 전 `creditTotals`로 되돌려 돌리면 expected 290, actual 291로 실패 확인 후 복구 |
| 금액 할인 줄을 일부 반품할 때 할인이 지금처럼 수량 비율로 나뉜다 | 통과 | `returnedDiscount`는 변경 없음(diff에 없음). 기존 테스트(`credit-note.test.js:50`)가 통과 |
| 저장된 `totals`가 있는 반품 전표와 청구서는 저장된 금액이 그대로 나온다 | 통과 | `creditNoteTotals`는 변경 없음. 저장 금액 테스트(`credit-note.test.js:77`)와 `invoice.test.js`가 통과 |
| `src/format/`의 출력 형식은 바뀌지 않는다 | 통과 | `git diff e0852d8 --stat`에 `src/format/` 변경 없음. 전체 테스트 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 새 테스트 25줄 추가만 있고 기존 테스트는 그대로다. 수정 전 코드에서 실패함을 확인했다.

## 남은 위험
- 과세 줄이 섞인 영세율·면세 줄을 직접 확인하는 새 테스트는 없다(기존 분개·합계 테스트로만 덮임).
- `creditTotals`가 공용 `lineVat`/`sumLineVat` 대신 직접 계산한다. 앞 Work(w-20261004-001) 머지 뒤 공용 함수로 바꿀 수 있다.
- 청구서·견적(`src/invoice/total.js`)은 사람이 범위에서 뺐다.
