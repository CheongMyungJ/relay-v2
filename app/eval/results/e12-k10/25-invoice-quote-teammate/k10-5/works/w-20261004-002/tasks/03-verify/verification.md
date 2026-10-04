## 리뷰 지적
1. [사소] test/credit-note.test.js:117 — 기대값 `0 + Math.floor(((1990 * 3 - 300) * 10) / 100)`의 `0 +`가 불필요하고 구현 식을 그대로 베껴 검증이 약함. 고정값 567로 바꾸자는 제안

(그 밖에 원인 대응, 비목표, 경계 조건: 원인(합계 한 번 반올림)을 직접 고쳤고 `src/format/`과 저장된 totals 경로는 바뀌지 않음. 지적 없음)

## 반영
- 1 — 기대값을 567로 고침. 커밋 ea2ccc1. `npm test` 50 통과 / 0 실패. 재현 절차는 바꾸지 않음. 같은 커밋에 `docs/knowledge/billing/vat-rounding.md`(팀 지식)도 남김

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(CN-0112 반품 요청을 INV-2047로 만든 환불 합계)가 더 이상 회계팀 계산과 어긋나지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112)` 직접 실행: `{supply:17438, taxable:17438, exempt:0, vat:1742, total:19180}`. 줄별 923+612+207=1,742. (수정 전 vat 1,744/19,182는 fix.md 기록. 회계팀의 실제 기대값은 요청에 없어 규칙으로 계산한 값과 비교) |
| `npm test`가 통과한다 | 통과 | `npm test`: 50 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 581c76d -- test/`는 추가만 있고 기존 줄 변경·삭제 없음 |
| 반품 전표의 부가세는 과세 줄마다 할인 후 공급가액에 `VAT_RATE_PERCENT`를 곱해 원 단위로 버림한 값의 합이며, 합계에서 다시 반올림하지 않는다 | 통과 | `src/invoice/credit-note.js` `creditTotals`가 과세 줄마다 `percentOfFloor(r.net, VAT_RATE_PERCENT)`를 `sumWon`으로 합산. CN-0112 테스트 통과 |
| 면세 줄과 영세율 반품 전표의 부가세는 0이다 | 통과 | 면세 줄은 `taxable` 필터로 제외, `zeroRated`는 0. 테스트 "면세 줄은 부가세 0, 영세율 전표는 부가세 0" 통과(면세 BK-1800 exempt 18000, 영세율 vat 0) |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 다시 계산하지 않고 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 기존 테스트(test/credit-note.test.js:77, 저장 totals vat 289)가 통과 |
| `src/format/`의 파일과 출력 결과가 바뀌지 않는다 | 통과 | `git diff 581c76d --stat -- src/format` 출력 없음. `npm test`의 format 테스트 통과 |
| CN-0112의 줄별 부가세 계산을 확인하는 테스트가 추가된다 | 통과 | 테스트 "CN-0112: 부가세는 과세 줄마다 원 단위 버림 후 합산"이 추가됨(vat 1742, total 19180). 수정 전 실패는 fix.md 기록으로만 확인했고 이번에 되돌려 재실행하지는 않음 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 2개 추가만 있고 기존 단언은 그대로. 반영한 지적 1도 새 테스트의 기대값을 고정값으로 바꾼 것

## 남은 위험
- `percentOfFloor`는 앞 Work(w-20261004-001)에서도 추가했을 수 있음, 머지 대기. 머지 때 충돌 가능
- 청구서(`computeTotals`)와 견적서(`quoteTotals`)는 이번 범위 밖이라 이 브랜치에서는 Math.round 그대로. 앞 Work에서 고쳤을 수 있음, 머지 대기
- 부분 반품 시 할인 반올림(322.5→323)은 규칙이 없어 그대로 둠
- 회계팀의 실제 기대 합계(19,180원)는 요청에 없어 규칙으로 계산한 값임
