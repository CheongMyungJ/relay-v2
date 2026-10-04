## 리뷰 지적
1. [사소] src/invoice/credit-note.js:91 — 부가세 식이 한 줄에 길게 인라인으로 들어 있다. 과세 줄 필터와 버림 식을 나누면 읽기 쉽다. 앞 Work 머지 뒤 `floorPercentOf`로 바꿀 때 함께 정리할 수 있다.

(차단·권장 지적 없음. 원인(합계 한 번 반올림)을 고쳤고 증상만 가리지 않는다. 비목표(`total.js`, `src/format/`, 음수 줄)는 건드리지 않았다.)

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 고름)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (CN-0112를 INV-2047에 적용하면 환불 합계 19,180원) | 통과 | `createCreditNote` + `creditNoteTotals` 스크립트 재실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }` |
| `npm test`가 통과한다 | 통과 | `npm test`: 49개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 69b1c27 -- test/`는 추가만 있고 삭제·수정된 기존 단언 없음 |
| CN-0112의 부가세 1,742원, 합계 19,180원을 확인하는 테스트가 있다 | 통과 | `test/credit-note.test.js` `반품 전표 부가세는 줄마다 버림한 합이다 (CN-0112)`, 전체 실행에서 통과 |
| 면세 줄과 `zeroRated` 반품 전표의 부가세가 0인 것을 확인하는 테스트가 있다 | 통과 | `면세 줄과 영세율 반품 전표의 부가세는 0이다`, 통과 |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 저장값을 그대로 돌려준다 | 통과 | `저장된 totals가 있으면 다시 계산하지 않는다` 통과(`strictEqual`로 같은 객체 확인). 코드 `note.totals ?? creditTotals(note)` |
| `src/format/`의 파일이 바뀌지 않는다 | 통과 | `git diff 69b1c27 --stat -- src/format` 출력 없음 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 3개와 `readFileSync` import만 추가했고 기존 테스트는 그대로다.

## 남은 위험
- `floorPercentOf`는 앞 Work(w-20261004-001) 머지 대기라 인라인 식을 썼다. 머지 뒤 도우미로 바꿀 수 있다.
- 청구서 합계 `src/invoice/total.js`는 범위 밖이라 이 브랜치에서는 아직 `Math.round`다. 앞 Work에서 고쳤을 수 있음, 머지 대기.
- 음수 공급가액 줄의 부가세는 미정이고, 지금은 `Math.floor`로 0에서 멀어지는 쪽으로 내림한다.
