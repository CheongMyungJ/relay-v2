## 리뷰 지적
1. [사소] src/invoice/credit-note.js:93 — 과세 줄을 `rows.filter(taxable)`로 세 번째 거르고 있다(taxable 합계 줄과 중복). 과세 행을 변수로 빼면 읽기 쉽다. 동작은 맞다.
2. [사소] test/credit-note.test.js:117 — `저장된 totals가 있으면 다시 계산하지 않는다`는 수정 전에도 통과한다(수정을 잡지 못하는 보호용 테스트). 또 `examples/...`를 cwd 기준 상대 경로로 읽어 레포 루트에서 돌릴 때만 동작한다. 나머지 두 테스트는 수정 전에 실패해 수정을 잡는다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals` 재실행 → `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. 수정 전 1744 / 19182 |
| `npm test`가 통과한다 | 통과 | `npm test` → 51 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2fca62a`: 테스트 파일은 import 1줄과 테스트 3개 추가뿐, 기존 단언 변경·삭제 없음 |
| 반품 전표 부가세가 과세 줄별 `Math.floor` 합으로 계산됨을 확인하는 테스트가 있다 | 통과 | `반품 전표 부가세는 과세 줄마다 버림한 합이다`: 105원 두 줄 → vat 20(합계 기준이면 21). `node --test test/credit-note.test.js` 8 pass |
| CN-0112를 `examples/INV-2047.json` 기준으로 만들면 부가세는 줄별 버림 합이고 환불 합계는 19,182원이 아니다 | 통과 | 위 재현 실행: 923+612+207=1,742, 합계 19,180. `CN-0112 부가세는 줄별 버림 합이다` 테스트도 통과 |
| 영세율 반품 전표의 부가세는 0원, 면세 줄은 부가세에 더해지지 않음을 테스트가 확인한다 | 통과 | 같은 테스트에서 `zeroRated: true`일 때 vat 0, 면세 999원 줄은 vat 20에 불포함(`exempt: 999`) |
| `totals`가 저장된 반품 전표와 청구서는 `creditNoteTotals`가 저장된 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`이고 변경 없음. 저장된 totals 테스트 통과. 청구서 쪽은 이 브랜치에서 변경 없음 |
| `src/format/`의 출력은 바뀌지 않는다(`test/format.test.js` 통과) | 통과 | `git diff 2fca62a --stat`에 src/format 없음. `node --test test/format.test.js` 4 pass |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — import와 새 테스트 3개만 추가했고 기존 테스트는 그대로다

## 남은 위험
- 회계팀 계산이 줄별 버림과 같은지는 확인하지 못했다(사람이 정한 방식).
- `taxType`이 없는 줄은 면세로 계산된다(기존 `isTaxableLine` 동작).
- 앞 Work(w-20261004-001)에서 청구서 쪽을 고쳤을 수 있음, 머지 대기. 지식 파일 `docs/knowledge/invoice/vat-per-line-floor.md`가 그 Work의 것과 같은 경로라 머지 시 충돌할 수 있다.
- 견적서(`src/invoice/quote.js`)는 비목표라 여전히 합계 기준 반올림이다.
