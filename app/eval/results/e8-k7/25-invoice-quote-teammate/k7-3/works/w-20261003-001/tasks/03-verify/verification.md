## 리뷰 지적
1. [사소] src/invoice/total.js:27 — 부가세 계산이 한 줄에 길게 몰려 있다. 줄별 부가세를 이름 붙인 변수로 나누면 읽기 쉽다. 동작은 같다.

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`examples/INV-2031.json`의 합계가 29,079원) | 통과 | `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079 |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 51, pass 51, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 14cc49d -- test`: `test/total.test.js`에 테스트 3개 추가만 있고 삭제·수정 없음 |
| 부가세가 줄별 원 단위 버림 합으로 계산됨을 확인하는 테스트가 있다 | 통과 | `test/total.test.js` 끝 3개. `node --test test/total.test.js` → pass 8, fail 0. INV-2031과 할인 혼합 테스트는 수정 전 코드에서 실패한다고 fix.md에 기록됨 |
| 면세 품목과 영세율(`zeroRated`) 청구서의 부가세는 계속 0원 처리된다 | 통과 | 면세 줄은 과세 줄만 합산해서 제외되고 `zeroRated`는 0 분기 그대로. 할인·면세 혼합 테스트와 영세율 테스트 통과 |
| 이미 발행된 청구서의 합계가 바뀌지 않는다 | 통과 | `invoiceTotals`는 저장된 totals를 사용(src/invoice/invoice.js:41). `test/invoice.test.js` '발행된 청구서는 저장된 합계를 쓴다' 통과. `node src/cli.js examples/INV-2047.json --totals` → 저장값 vat 5801, total 63807 그대로 |
| `src/format/` 파일과 그 출력은 변경되지 않는다 | 통과 | `git diff --stat 14cc49d -- src/format` 결과 없음 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 기존 테스트는 그대로이고 새 테스트 3개만 추가했다

## 남은 위험
- credit-note.js:90과 quote.js:42-44는 합계 기준 반올림이라 청구서와 규칙이 다르다 (intent 범위 밖, 회계 확인 필요)
- 발행됐지만 totals가 저장되지 않은 데이터는 invoiceTotals가 새 규칙으로 다시 계산한다
