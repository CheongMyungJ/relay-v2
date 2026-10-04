## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`node src/cli.js examples/INV-2031.json --totals`의 합계가 29,079원) | 통과 | 직접 실행: vat 2641, total 29079 (fix.md의 수정 전 2644/29082와 비교) |
| `npm test`가 통과한다 | 통과 | 직접 실행: tests 50, pass 50, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2fca62a -- test/`는 추가 28줄뿐, 삭제·수정 없음 |
| 줄별 부가세 버림 합산을 확인하는 테스트가 추가되고, 면세 줄과 영세율 경우도 포함한다 | 통과 | test/total.test.js 끝 2개: INV-2031(2641), 면세 줄 제외(210)와 zeroRated(0) |
| 발행된 청구서가 저장된 `totals`를 그대로 쓰는 동작이 바뀌지 않는다 | 통과 | src/invoice/invoice.js는 diff에 없음. 41행이 발행 청구서의 저장 totals를 그대로 반환 |
| `src/format/`의 파일과 서식 출력이 바뀌지 않는다 | 통과 | `git diff 2fca62a --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트 2개를 끝에 추가했을 뿐 기존 테스트와 단언은 그대로다.

## 남은 위험
- 견적서(src/invoice/quote.js)와 반품 전표(src/invoice/credit-note.js:90)는 합계 기준 반올림이라 청구서와 부가세가 어긋날 수 있다(범위 밖).
- 회계팀 공식 기준은 확인되지 않았다.
- 할인이 공급가액보다 커 `net`이 음수가 되는 줄은 `Math.floor`가 0에서 멀어지는 쪽으로 버린다. 이 경우는 확인하지 않았다.
