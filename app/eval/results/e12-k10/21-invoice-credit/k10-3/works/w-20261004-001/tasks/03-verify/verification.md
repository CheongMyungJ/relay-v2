## 리뷰 지적
없음

(검토 내용: 원인(`computeTotals`의 합계 기준 `Math.round`)을 줄별 `Math.floor` 합산으로 고쳐 증상이 아닌 원인을 해결했다. `net * 10`이 정수라 `/100` 후 버림에 부동소수점 오차가 없다. 면세 줄·`zeroRated`는 기존대로 처리된다. 불필요한 변경 없음.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`examples/INV-2031.json`을 계산하면 합계가 29,079원이다) | 통과 | `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079 (fix.md의 수정 전 값 2644/29082와 비교) |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 48, pass 48, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 55ac230` 에서 test/total.test.js에 테스트 2개 추가만 있고 기존 줄 삭제·수정 없음 |
| 줄별 부가세 버림 합산 규칙(할인 후 줄 금액 기준, 합계에서 재반올림 없음)을 검증하는 테스트가 추가된다 | 통과 | test/total.test.js 신규 2개: INV-2031 합계(vat 2641), 할인·면세 혼합(vat 398). fix.md에 수정 전 실패 기록(46 pass / 2 fail) |
| 이미 발행되어 저장된 합계를 가진 청구서는 다시 계산되지 않고 저장된 합계가 그대로 쓰인다 | 통과 | `invoiceTotals`(src/invoice/invoice.js:40)는 변경 없음. 기존 test/invoice.test.js:38-39(저장 합계 26894 유지)가 통과 |
| `src/format/`의 파일이 변경되지 않고 출력 형식 관련 기존 테스트가 그대로 통과한다 | 통과 | `git diff 55ac230 --stat -- src/format` 출력 없음. invoice-text 테스트 포함 `npm test` 전부 통과 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 기존 테스트는 그대로이고 새 테스트 2개만 끝에 추가됨

## 남은 위험
- 반품 전표 `creditTotals`(src/invoice/credit-note.js:90)는 여전히 합계 기준 반올림이라 같은 품목을 반품하면 청구서와 1원 차이가 날 수 있다. 사람이 범위에서 뺐고 회계팀 확인 후 정한다.
- `zeroRated`, 줄이 하나인 경우의 새 경로 전용 테스트는 없다(해당 동작은 변경 없음).
