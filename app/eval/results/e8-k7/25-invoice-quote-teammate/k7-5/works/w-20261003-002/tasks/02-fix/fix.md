## 재현
- 재현 절차: `createCreditNote(examples/INV-2047.json, examples/CN-0112.json)`을 호출해 `totals`를 출력 (스크립트로 실행)
- 결과: 재현됨
- 기대: vat 1,742원, 환불 합계 19,180원
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 세율을 곱해 `Math.round`로 한 번만 반올림한다. 회사 규칙은 줄마다 버림한 부가세의 합이다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. 줄별로 계산하면 923+612+207=1,742, 합계 기준은 17,438×10%=1,743.8→1,744. 수정 뒤 19,180원이 나옴. 줄 수가 하나이거나 소수점 이하가 없으면 차이가 없어 기존 테스트는 통과했다.
- 사람 추정 판정: 없음 (추가 의견은 수정 대상 파일 안내뿐)
- 기각한 가설: 금액 할인의 `Math.round`(returnedDiscount)가 원인 — 이 예시는 전량 반품이라 할인이 청구서와 같고, 비율 할인은 규칙상 할인 후 금액을 쓰므로 기각

## 변경 요약
- src/invoice/credit-note.js — 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)`로 계산해 합산. 영세율은 0, 면세 줄은 제외. `creditNoteTotals`의 저장 금액 우선 동작은 그대로.
- test/credit-note.test.js — 재현 테스트와 면세 줄 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js `부가세는 과세 줄마다 버림해 합산한다 (CN-0112)`
- 수정 전: 실패 (`node --test` → `not ok 6`, 49 pass / 1 fail)
- 수정 후: 통과 (`npm test` → 50 pass / 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 pass, 0 fail
- 실패 항목: 없음
