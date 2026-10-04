## 재현
- 재현 절차: 워크트리에서 `createCreditNote(INV-2047, CN-0112)`를 실행해 `totals`를 출력 (examples/INV-2047.json, examples/CN-0112.json)
- 결과: 재현됨
- 기대: vat 1,742원, total 19,180원
- 실제: vat 1,744원, total 19,182원

## 원인
- 원인: `creditTotals`가 부가세를 과세 공급가액 합에 세율을 곱해 `Math.round`로 한 번만 계산해, 줄별 버림 규칙과 몇 원 어긋난다.
- 근거: src/invoice/credit-note.js `creditTotals`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 17,438 × 10% = 1,743.8 → 1,744. 줄별 버림은 923+612+207 = 1,742. 수정 뒤 CN-0112가 19,180원이 됨(실험으로 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)` 후 합산. 면세 줄은 제외, 영세율은 0 유지. 저장된 totals를 쓰는 `creditNoteTotals`는 그대로.
- test/credit-note.test.js — 테스트 2개 추가 (기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js '반품 전표 부가세는 과세 줄별 원 단위 버림 합산이다' (CN-0112 줄 금액 사용, 면세 줄과 영세율 포함), '저장된 totals가 있는 반품 전표는 다시 계산하지 않는다'
- 수정 전: 실패 (src만 되돌리고 `npm test` → 1 fail, 해당 테스트)
- 수정 후: 통과 (`npm test` → 50 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 pass, 0 fail
- 실패 항목: 없음
