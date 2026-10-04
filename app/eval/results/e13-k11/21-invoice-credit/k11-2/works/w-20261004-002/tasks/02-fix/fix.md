## 재현
- 재현 절차: 레포 루트에서 `examples/INV-2047.json`으로 청구서를 읽고 `examples/CN-0112.json`으로 `createCreditNote(inv, data).totals`를 출력한다 (`node /tmp/repro.mjs` 형태의 한 줄 스크립트).
- 결과: 재현됨
- 기대: 부가세 923+612+207 = 1,742원, 합계 19,180원 (팀 지식 vat-per-line-floor.md 규정)
- 실제: `{ supply: 17438, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 `Math.round(합 × 10 / 100)`으로 부가세를 한 번에 계산해, 줄마다 버림 규정과 합계 반올림 때문에 몇 원씩 어긋났다.
- 근거: `src/invoice/credit-note.js:90` (수정 전). CN-0112 줄별 공급가액 9236·6127·2075(합 17438); 합계 반올림은 1,743.8→1,744, 줄마다 버림은 1,742. 줄마다 버림으로 바꾸자 실제 값이 19,180원이 되고 수정 전에는 19,182원이었다(실험). 부가세가 줄마다 정수로 떨어지면 두 방식이 같아 어긋남이 없다(기존 테스트 값은 그대로 통과).
- 사람 추정 판정: 없음 (추가 의견은 관련 코드 위치뿐)
- 기각한 가설: 할인 계산 오차(`returnedDiscount`) — 규정은 할인 반올림을 바꾸라고 하지 않았고, 부가세 계산만 바꿔 규정 값이 나옴

## 변경 요약
- src/invoice/total.js — `lineVat(net)` 추가(줄 하나의 부가세, 원 단위 버림). 팀 지식이 가리키는 위치이나 기준 브랜치에 없어 추가함. `computeTotals`는 건드리지 않음(비목표).
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄마다 `lineVat`로 계산해 합산. 영세율은 0원, 면세 줄 제외. `creditNoteTotals`는 그대로(저장된 `totals` 우선).
- test/credit-note.test.js — 테스트 2개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js `CN-0112: 부가세는 줄마다 원 단위 버림으로 계산해 합산한다`, 보조로 `저장된 금액이 있는 반품 전표는 다시 계산하지 않는다`
- 수정 전: 실패 (`npm test` → 1 fail, vat 1744 / total 19182가 기대와 다름)
- 수정 후: 통과 (`npm test` → 48 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 48 pass, 0 fail
- 실패 항목: 없음 (기준 커밋에서도 46 pass 0 fail)
