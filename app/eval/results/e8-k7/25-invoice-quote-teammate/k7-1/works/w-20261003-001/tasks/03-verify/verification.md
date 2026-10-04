## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079 (수정 전 2644/29082) |
| `npm test`가 통과한다 | 통과 | `npm test` → 50 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff a4d444e`에서 test/total.test.js는 추가만 있고 기존 줄 삭제·수정 없음 |
| 과세 줄마다 할인 후 금액에 부가세를 원 단위 버림으로 계산해 합산하는 테스트가 추가된다 | 통과 | test/total.test.js 2건 추가(INV-2031 줄별 합 2641, 할인 10% 줄 1799→179 + 면세 제외) |
| 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 0원 처리가 유지된다 | 통과 | total.js는 zeroRated면 0, 면세 줄은 필터로 제외. 기존 test/total.test.js:37, test/invoice.test.js:60 통과, 신규 테스트가 면세 제외 확인 |
| 이미 발행된 청구서의 저장된 합계는 재계산 없이 그대로 쓰인다 | 통과 | src/invoice/invoice.js invoiceTotals 변경 없음, test/invoice.test.js:33 통과 |
| `src/format/`의 파일과 출력 결과가 바뀌지 않는다 | 통과 | `git diff a4d444e --stat -- src/format` 출력 없음, 전체 테스트 통과 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트 2개를 끝에 추가했을 뿐 기존 단언은 그대로다

## 남은 위험
- src/invoice/quote.js, src/invoice/credit-note.js는 반올림 방식이라 같은 품목에서 청구서와 부가세가 몇 원 다를 수 있다(비목표라 유지, docs/knowledge에 기록)
- 세율 10%가 아닌 값으로 바뀌면 `r.net * VAT_RATE_PERCENT / 100`의 부동소수점 오차 가능성 (현재 정수 10이라 문제 없음)
