## 리뷰 지적
1. [사소] test/credit-note.test.js:111 — 영세율 반품 테스트는 수정 전 코드에서도 통과한다(영세율은 원래 0). 회귀 방지용 가드로는 유효하나 이번 수정을 잡아내지는 않는다.
2. [사소] src/invoice/credit-note.js:90 — 과세 줄이 여럿이고 줄 일부가 면세인 경우의 줄별 버림 경계 테스트가 따로 없다. 기존 테스트(line 36)가 과세·면세 혼합 합계를 확인하므로 동작 결함은 아니다.

변경은 원인(합계 기준 `Math.round`)을 줄별 `Math.floor` 합산으로 직접 고쳤고, 비목표(발행분 재계산, `src/format/`, `quote.js`)를 건드리지 않았다.

## 반영
없음 (사람이 반영하지 않음을 선택). 지식 파일 `docs/knowledge/invoice/vat-per-line-floor.md`만 추가 커밋함(코드 변경 없음).

## 반영하지 않은 지적
- 1
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (CN-0112 환불 금액이 회계팀 계산 기준과 일치) | 통과 | fix.md의 재현 스크립트 경로(`/tmp/claude-0/repro.mjs`)는 다른 Work의 INV-2031 스크립트라 쓰지 않고, `createCreditNote(INV-2047, CN-0112).totals`를 직접 실행. 기준 커밋 109c76d: vat 1744 / total 19182, 현재: vat 1742 / total 19180. 기준 금액은 intent 추가 의견대로 규칙 계산값(923+612+207) |
| `npm test`가 통과한다 | 통과 | `npm test` → 50 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 109c76d`에서 테스트는 추가 2개뿐, 삭제·수정 없음 |
| 반품 전표 부가세가 반품 줄마다 (할인 후 공급가액 × 세율)을 원 단위 버림으로 계산한 값의 합이다 | 통과 | `creditTotals`가 `Math.floor(net × 세율 / 100)`를 줄마다 `sumWon`으로 합산. CN-0112 1,742 확인 |
| 면세 줄과 영세율(`zeroRated`) 반품 전표의 부가세는 0이다 | 통과 | 면세 줄은 `taxable` 필터에서 제외, 영세율은 `note.zeroRated ? 0`. 영세율 테스트와 기존 혼합 테스트 통과 |
| 저장된 `totals`가 있는 반품 전표와 청구서는 `creditNoteTotals`가 다시 계산하지 않고 저장값을 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? ...`로 미변경. 기존 테스트(test/credit-note.test.js:77)가 저장값 반환 확인 |
| `src/format/`의 파일은 변경되지 않는다 | 통과 | `git diff 109c76d --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 기존 테스트는 그대로, 테스트 2개만 추가

## 남은 위험
- 회계팀의 실제 CN-0112 금액을 확인하지 못했다. 19,180원은 규칙 계산값이다.
- 부분 반품 시 금액 할인은 수량 안분 반올림이라 청구서 줄 할인과 1원 차이날 수 있다(미확인).
- 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 청구서 `computeTotals`(src/invoice/total.js)는 이 브랜치에서 아직 합계 기준 `Math.round`다.
