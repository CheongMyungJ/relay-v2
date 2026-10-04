## 리뷰 지적
1. [권장] test/total.test.js — 영세율·면세 줄이 줄별 내림 계산에서도 부가세 0/제외로 유지되는지 `computeTotals` 단위 테스트가 없다. 두 경우의 테스트 추가를 제안한다. (발행 청구서의 저장 합계 유지는 test/invoice.test.js:39에 이미 테스트가 있어 추가 불필요)
2. [사소] src/invoice/total.js:29 — 과세 줄 filter가 `taxable` 계산과 중복된다. 변수로 빼면 읽기 쉽다.

차단 지적은 없다. 변경은 원인(합계 기준 반올림 → 줄별 내림 합)을 직접 고쳤고 비목표를 건드리지 않았다.

## 반영
- 1 — test/total.test.js에 영세율·면세 혼합 테스트 2개 추가, 커밋 3e5d67e. `npm test` 51개 통과. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 2 (사람이 '차단·권장만 반영'을 골라 제외)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079. 수정 전 재현은 fix.md 기록(2,644/29,082)과 비교. |
| `npm test`가 통과한다 | 통과 | `npm test` → 51개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 800a803`로 기존 테스트 줄 삭제·수정 없음, 추가만 있음 |
| 부가세는 과세 줄마다 원 단위 내림한 값의 합이다 | 통과 | src/invoice/total.js의 `Math.floor` 줄별 합. INV-2031 테스트(2641)와 CLI 결과로 확인 |
| 이미 발행된 청구서의 저장된 합계는 그대로 쓰이고 재계산되지 않는다 | 통과 | `invoiceTotals`(invoice.js:40) 미변경. test/invoice.test.js:29·39 통과 |
| `src/format/`의 출력 형식은 바뀌지 않는다 | 통과 | `git diff 800a803 -- src/format` 변경 없음, invoice-text 테스트 통과 |
| 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 이전과 같이 0 또는 제외된다 | 통과 | 추가한 total.test.js 테스트 2개와 기존 invoice-text·credit-note 테스트 통과 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트만 추가(INV-2031 재현, 영세율, 면세 혼합), 기존 테스트는 그대로

## 남은 위험
- 반품 전표(credit-note.js creditTotals)와 견적서(quote.js quoteTotals)는 합계 기준 반올림이라 청구서와 몇 원 차이날 수 있음 (사람이 범위에서 뺌)
- 줄별 내림 기준을 할인 후 공급가액으로 가정함 (fix.md)
