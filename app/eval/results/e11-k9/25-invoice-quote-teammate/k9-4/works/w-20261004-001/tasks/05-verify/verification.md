## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079. CN-0112 부가세 1742, Q-0457 부가세 3587도 fix.md의 기대와 같음 |
| `npm test`가 통과한다 | 통과 | `npm test` → 51개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 테스트 3개 파일은 케이스 추가만 있고 기존 단언 변경·삭제 없음(`git diff 800a803`) |
| 부가세는 과세 줄마다 원 단위 내림한 값의 합이다 | 통과 | `src/invoice/vat.js`의 `Math.floor`와 `sumLineVat`을 total/credit-note/quote가 사용. 새 테스트 3개가 검증. 다른 곳에 부가세 계산 코드 없음(grep) |
| 이미 발행된 청구서의 저장된 합계는 그대로 쓰이고 재계산되지 않는다 | 통과 | `src/invoice/invoice.js` 발행 경로와 `creditNoteTotals`의 `note.totals ?? creditTotals(note)`가 변경되지 않음(diff에 없음) |
| `src/format/`의 출력 형식은 바뀌지 않는다 | 통과 | `git diff 800a803 --stat -- src/format` 결과 변경 없음 |
| 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 이전과 같이 0 또는 제외된다 | 통과 | `sumLineVat`이 영세율이면 0, `taxable`인 줄만 합산. 견적 테스트에 면세 줄 포함, 기존 영세율 테스트 포함 51개 통과 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 새 케이스(INV-2031)만 추가
- test/quote.test.js — 약화 아님 — 새 케이스만 추가
- test/credit-note.test.js — 약화 아님 — 새 케이스만 추가

## 남은 위험
- 견적서 부가세가 줄별 내림이라 이미 안내한 견적과 몇 원 달라질 수 있음
- 저장된 totals가 없는 반품 전표·초안 청구서는 새 규칙으로 다시 계산됨
- 반품 전표의 반품 할인(`returnedDiscount`)은 기존 반올림을 그대로 둠(부가세 외 규칙)
