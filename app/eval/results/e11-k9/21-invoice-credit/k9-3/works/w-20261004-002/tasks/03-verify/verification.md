## 리뷰 지적
없음

(검토: `git diff f23573e`는 `src/invoice/credit-note.js` `creditTotals`의 vat 계산과 `test/credit-note.test.js` 테스트 2개 추가뿐이다. 원인(합계 반올림)을 줄별 버림 합산으로 고쳤고 증상만 가린 것이 아니다. 비목표(`computeTotals`, `src/format/`, 발행분 `totals`)는 건드리지 않았다. `creditNoteTotals`는 저장된 `totals`를 그대로 쓴다. 영세율 0, 면세 줄 제외 모두 유지된다.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(examples/CN-0112.json을 examples/INV-2047.json에 반품한 전표의 환불 합계 확인)가 더 이상 실패한다고 보이지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals` 실행 → `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }`. 수정 전 값은 vat 1,744 / total 19,182 |
| `npm test`가 통과한다 | 통과 | `npm test` → 48개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 테스트 파일은 추가만 있고 기존 테스트와 단언은 그대로다 |
| 반품 전표 부가세가 과세 줄마다 (할인 후 줄 금액 × 세율)을 원 단위로 버림한 값의 합이다 | 통과 | `credit-note.js:90-93`이 과세 줄마다 `Math.floor(net × 세율 / 100)` 후 `sumWon`으로 합산한다. CN-0112는 923+612+207 = 1,742 |
| 면세 줄과 영세율(`zeroRated`) 전표의 부가세는 0이다 | 통과 | 면세 줄은 필터로 제외되고 `zeroRated`면 0이다. 새 테스트가 확인한다(면세 포함 vat 435, 영세율 0) |
| 위 규칙을 확인하는 테스트(CN-0112 포함)가 추가된다 | 통과 | 테스트 2개가 추가되었다. 수정 전 코드(`src`를 f23573e로 되돌림)로 `npm test`를 돌리면 47개 통과, 1개 실패(CN-0112 테스트)라서 수정을 잡아낸다 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 2개와 `readFileSync` import만 추가했다. 기존 테스트·단언 변경이나 삭제는 없다.

## 남은 위험
- 앞 Work(w-20261004-001)에서 `creditTotals`를 이미 고쳤을 수 있고 머지 대기 중이다. 머지 시 `credit-note.js`에서 충돌할 수 있다.
- 이미 발행된 반품 전표의 저장된 `totals`는 재계산하지 않는다(비목표).
- `computeTotals`(청구서)는 이 브랜치에서 아직 합계 반올림일 수 있으나 비목표라 건드리지 않았다.
- 면세 줄과 영세율 테스트는 수정 전에도 통과하는 보호용 테스트다.
