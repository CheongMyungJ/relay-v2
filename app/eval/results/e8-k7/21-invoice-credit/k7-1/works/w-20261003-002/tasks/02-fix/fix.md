## 재현
- 재현 절차: 레포 루트에서 `examples/INV-2047.json`, `examples/CN-0112.json`으로 `createCreditNote(invoice, data).totals`를 출력 (임시 스크립트)
- 결과: 재현됨
- 기대: 줄별 버림 합 부가세 923+612+207 = 1,742원, 합계 19,180원
- 실제: `{ supply: 17438, vat: 1744, total: 19182 }` (부가세 2원 큼)

## 원인
- 원인: `creditTotals`가 부가세를 과세 공급가액 합계에 `Math.round`로 한 번만 계산해, 줄별 버림 규칙과 어긋난다.
- 근거: src/invoice/credit-note.js `creditTotals`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 17,438×10% = 1,743.8 → 1,744. 줄별 버림은 1,742. 수정 후 같은 입력이 1,742/19,180으로 바뀜(실험 확인). 줄 합이 반올림 값과 같으면(줄별 소수 부분이 작을 때) 어긋나지 않으므로 "몇 원 어긋남"이라는 조건과도 맞는다.
- 사람 추정 판정: 없음
- 기각한 가설: 할인 반올림(`percentOf`/`returnedDiscount`)이 원인 — 비목표이고, 공급가액 17,438은 그대로 두었을 때 부가세 규칙만 바꿔 규칙 값이 나오므로 이번 차이의 원인이 아님 (회계팀 할인 계산과의 일치는 확인하지 않음)

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net × 세율/100)`한 합으로 변경. 영세율은 0 유지. `creditNoteTotals`는 저장된 totals를 그대로 반환(변경 없음).
- test/credit-note.test.js — 테스트 추가(기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js "반품 전표 부가세는 과세 줄마다 원 단위 버림의 합이다" (CN-0112/INV-2047, 면세 줄, 영세율)
- 수정 전: 실패 (`npm test` → pass 46, fail 1; vat 1744 ≠ 1742)
- 수정 후: 통과 (`npm test` → pass 47, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 47개 통과, 0개 실패 (`src/format/` 테스트 포함 그대로 통과)
- 실패 항목: 없음
