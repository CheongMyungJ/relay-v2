## 재현
- 재현 절차: 작업 디렉터리에서 `createCreditNote(INV-2047.json, CN-0112.json)`을 호출해 `totals`를 출력한다(임시 스크립트, 커밋하지 않음)
- 결과: 재현됨
- 기대: 부가세 = 줄별 부가세(할인된 과세 줄에 `Math.floor`)의 합 = 923+612+207 = 1,742원, 합계 19,180원
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 부가세를 한 번만 `Math.round`로 매겼다(줄별 계산·버림이 아님). 그래서 줄별 버림 합과 몇 원 어긋난다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`(수정 전) `Math.round((taxable * VAT_RATE_PERCENT) / 100)` → 17,438×10% = 1,743.8 → 1,744. 줄별로는 9236→923, 6127→612, 2075→207 합 1,742. 수정 후 재현 입력이 vat 1742, total 19180을 낸다. 어긋남은 줄별 버림 합과 합계 반올림이 갈리는 경우에만 생기고, 면세·영세율은 부가세 0이라 영향이 없다.
- 사람 추정 판정: 없음
- 기각한 가설: 할인 안분(`returnedDiscount`)이 원인 — 기각. 공급가액 17,438은 줄별 계산과 일치하고 부가세 식만 다르다.

## 변경 요약
- `src/invoice/total.js` — `lineVat({net, taxable}, zeroRated)` 추가(면세·영세율 0, 그 외 `Math.floor`). 이 브랜치에는 `lineVat`이 없어 새로 만들었다. `computeTotals`는 비목표라 건드리지 않았다.
- `src/invoice/credit-note.js` — `creditTotals`의 부가세를 줄별 `lineVat` 합으로 바꿨다. 이미 저장된 전표는 `creditNoteTotals`가 저장값을 쓰므로 영향이 없다.
- `test/credit-note.test.js` — 테스트 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: `test/credit-note.test.js`의 '반품 전표 부가세는 줄마다 원 단위 버림 후 합산한다 (CN-0112)', '반품 전표 부가세: 면세 줄과 영세율은 0원'
- 수정 전: 실패 (`src`를 되돌리고 `npm test`: CN-0112 테스트 expected 1742, actual 1744, fail 1). 면세·영세율 테스트는 수정 전에도 통과했다(회귀 방지용).
- 수정 후: 통과 (`npm test`: pass 48, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0개 실패
- 실패 항목: 없음
