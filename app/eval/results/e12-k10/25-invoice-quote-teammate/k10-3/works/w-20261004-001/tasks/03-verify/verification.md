## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,082원이 아니라 29,079원으로 계산된다) | 통과 | `createInvoice(examples/INV-2031.json)` 후 `computeTotals` 직접 실행: total 29079 (vat 2641). 수정 전 `total.js`로 되돌려 `node --test test/total.test.js`: pass 5 / fail 2, 수정 후 7개 통과 |
| `npm test`가 통과한다 | 통과 | `npm test`: 50개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 403bb0f`에서 test/total.test.js는 추가만 있고 삭제·수정 없음 |
| 부가세가 과세 줄마다 할인 후 금액 기준 원 단위 버림으로 계산되고, 그 합이 청구서 부가세가 된다는 테스트가 있다 | 통과 | test/total.test.js 끝의 2개 (INV-2031 줄별 버림 2641, 할인 후 금액 기준·면세 0). 수정 전 코드에서는 실패 확인 |
| 면세 줄은 부가세가 0이고, 영세율 청구서의 부가세는 0이다 | 통과 | 면세 줄은 vat 합산에서 제외(새 테스트 299 확인). 영세율: INV-2031에 `zeroRated: true`로 실행 시 vat 0, 기존 테스트 `영세율 청구서는 부가세 0` 통과 |
| 발행된 청구서의 저장된 합계와 `src/format/`의 출력은 바뀌지 않는다 | 통과 | 변경 파일은 `src/invoice/total.js`와 테스트뿐 (`git diff --stat`). `invoiceTotals`는 발행 후 저장된 `totals`를 그대로 씀. format 테스트 통과 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 기존 테스트는 그대로 두고 새 테스트 2개만 추가

## 남은 위험
- `src/invoice/quote.js:42`와 `src/invoice/credit-note.js`의 `creditTotals`는 아직 합계 반올림 방식이라 같은 거래의 청구서와 몇 원 차이가 날 수 있다. 적용 여부는 사람이 정해야 한다 (지식 항목에 미정으로 기록)
- 초안 청구서는 다시 계산하면 값이 달라진다. 발행된 청구서는 저장된 totals를 쓴다
