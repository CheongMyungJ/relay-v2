## 재현
- 재현 절차: 레포 루트에서 `createCreditNote(INV-2047, CN-0112)`를 실행해 `totals`를 본다 (`examples/INV-2047.json`, `examples/CN-0112.json`). 수정 전 테스트로는 `node --test test/credit-note.test.js`
- 결과: 재현됨
- 기대: 부가세 1,742원, 환불 합계 19,180원
- 실제: `{ supply: 17438, taxable: 17438, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 세율을 곱해 `Math.round`로 한 번 반올림했다. 줄마다 버림해 합산하는 규칙과 줄별 소수 부분이 달라 어긋난다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 줄별 공급가액 9236/6127/2075 → 버림 923/612/207 = 1,742, 합계 19,180으로 기대값과 일치한다. 수정 전 코드 복원 실험에서 새 테스트가 실패했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/invoice/credit-note.js — 부가세를 과세 줄마다 `Math.floor(공급가액 × 세율 / 100)` 하고 합산. 영세율은 0, 면세 줄 제외, 저장된 `totals` 사용(`creditNoteTotals`)은 그대로.
- test/credit-note.test.js — 테스트 2개 추가 (기존 테스트는 바꾸지 않음).
- 청구서(`src/invoice/total.js`)는 비목표라 바꾸지 않음. `src/format/`도 그대로.

## 재현 테스트
- 위치: test/credit-note.test.js `반품 부가세는 과세 줄마다 버림해 합산한다 (CN-0112)`
- 수정 전: 실패 (`git stash`로 src만 되돌려 `node --test test/credit-note.test.js` → `not ok 6`, fail 1)
- 수정 후: 통과 (`node --test test/credit-note.test.js` → pass 7, fail 0)
- 보조 테스트(면세 제외, 영세율 0, 저장된 금액 유지, 합계 = 공급가액 + 부가세)는 수정 전에도 통과하는 동작 유지 확인용이다.

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음
