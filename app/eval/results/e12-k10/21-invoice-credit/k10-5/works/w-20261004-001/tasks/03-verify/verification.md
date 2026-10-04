## 리뷰 지적
1. [사소] test/credit-note.test.js:85 — 반품 전표 부가세 테스트가 수정 전 실패하는지 확인되지 않았고(계산상 수정 전 21원, 수정 후 20원이라 잡힘), 반품 전표 영세율 0원 케이스 테스트가 없음. 영세율 테스트 추가 제안
2. [사소] src/invoice/total.js:16 — `lineVat`이 export되지만 `sumLineVat`만 외부에서 쓰임. 내부 함수로 둘 것을 제안

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `computeTotals(createInvoice(examples/INV-2031.json))` 재실행: vat 2641, total 29079 |
| `npm test`가 통과한다 | 통과 | `npm test` 50 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 테스트 파일 변경은 추가만(64 insertions, 0 deletions) |
| 부가세가 과세 품목의 할인 후 줄 금액마다 원 단위 버림으로 계산되고, 그 합이 청구서 부가세다 | 통과 | `src/invoice/total.js` `lineVat`/`sumLineVat`(rows.net 기준 floor 후 합산), 할인 줄 테스트 통과 |
| 면세 품목과 영세율(`zeroRated`) 청구서의 부가세는 계속 0원이다 | 통과 | `sumLineVat`은 taxable 줄만 합산, `zeroRated`는 기존 분기 유지. 기존 영세율 테스트(test/total.test.js:37)와 면세 혼합 테스트 통과 |
| 줄별 버림 부가세, 할인 적용 줄, 면세 혼합 줄을 검증하는 테스트가 추가된다 | 통과 | test/total.test.js 끝 3개 추가, 전부 통과 |
| `src/format/` 파일과 그 출력 결과가 바뀌지 않는다 | 통과 | `git diff 3ad07f9 --stat -- src/format` 출력 없음, invoice-text 테스트 통과 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트 3개 추가만, 기존 줄 변경·삭제 없음
- test/credit-note.test.js — 약화 아님 — 테스트 1개 추가만, 기존 줄 변경·삭제 없음

## 남은 위험
- 반품 전표 수정은 intent 본문 밖(사람이 같이 고치기로 선택). 반품 테스트의 수정 전 실패는 실행으로 확인하지 못함
- 할인 계산(percentOf 반올림)은 바꾸지 않았다. 반품 전표 영세율 테스트 없음
