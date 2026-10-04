## 리뷰 지적
없음

## 반영
- 리뷰 지적은 없었다. 검증 후 사람이 범위를 넓혀 달라고 요청해(회계 규정은 문서 종류 무관, 견적서·반품 전표도 줄별 절사) 아래를 추가로 고쳤다. 커밋 a886b32.
  - `src/invoice/quote.js` `quoteTotals`, `src/invoice/credit-note.js` `creditTotals`가 `lineVat` 합으로 부가세를 계산한다. `lineVat`은 `src/invoice/total.js`에서 `export`만 붙였고 동작은 같다(재현 절차 INV-2031 결과 그대로).
  - Q-0457: vat 3587, total 56278. CN-0112: vat 1742, total 19180.
  - 테스트 추가: test/quote.test.js 2개, test/credit-note.test.js 1개(examples의 INV-2047·CN-0112 파일을 읽어 확인).
  - `docs/knowledge/invoice/vat-per-line-floor.md`를 문서 종류 무관 규칙으로 고쳤다.
  - 시험 명령 `npm test` → 53 pass, 0 fail.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(INV-2031 합계 계산)가 더 이상 실패하지 않는다 | 통과 | `createInvoice({customerId:'C', lines})` 후 `computeTotals` 직접 실행: vat 2641, total 29079 (수정 전 fix.md: 2644/29082) |
| `npm test`가 통과한다 | 통과 | 최종 코드에서 `npm test` → 53 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff df88ab4`에서 test 파일 3개 모두 추가만 있고 삭제·수정된 줄 없음 |
| `computeTotals`가 `examples/INV-2031.json`에 대해 vat 2,641, total 29,079를 돌려준다 | 통과 | 위 실행 결과 supply 26438, vat 2641, total 29079 |
| 면세 품목과 영세율(`zeroRated`) 청구서의 부가세는 계속 0원이다 | 통과 | 영세율은 `src/invoice/total.js`의 0 분기 유지, 기존 테스트 '영세율 청구서는 부가세 0' 통과. 면세 줄은 필터로 제외, 추가 테스트가 확인 |
| 줄마다 절사하는 경우를 확인하는 테스트가 추가된다 | 통과 | test/total.test.js 2개(INV-2031 값, 할인 후 절사·면세 제외)와 견적·반품 테스트가 추가됨. 청구서 테스트는 fix.md 기준 수정 전 2개 실패 |
| 저장된 합계를 쓰는 발행 청구서의 합계와 `src/format/` 출력 코드는 바뀌지 않는다 | 통과 | `git diff df88ab4 --stat`에 src/format/과 invoice.js 변경 없음. 저장 합계를 쓰는 `invoiceTotals`·`creditNoteTotals`도 그대로 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트 2개를 끝에 추가했을 뿐 기존 테스트 변경 없음
- test/quote.test.js — 약화 아님 — 테스트 2개 추가만 있고 기존 테스트 변경 없음
- test/credit-note.test.js — 약화 아님 — 테스트 1개와 `readFileSync` import만 추가, 기존 테스트 변경 없음

## 남은 위험
- 견적서·반품 전표 변경은 intent(버전 1)에 없던 범위 확장이며 사람이 요청했다. 견적서는 만들 때 합계를 계산하므로 이미 보낸 견적서의 금액과 몇 원 다를 수 있다. 저장된 반품 전표 합계는 그대로 쓴다.
- 초안 청구서는 새 방식으로 바뀐 합계가 발행 시 저장된다. 이미 발행된 청구서는 영향 없음.
