## 재현
- 재현 절차: `INV-2047.json`에 `CN-0112.json`으로 `createCreditNote`를 호출해 `totals`를 본다 (예: `node -e` 로 두 JSON을 읽어 실행).
- 결과: 재현됨
- 기대: 줄별 부가세 923(박스테이프) + 612(형광펜) + 207(지우개) = 1,742원, 합계 19,180원
- 실제: 부가세 1,744원, 합계 19,182원 (공급가액 17,438원 전체에 한 번 반올림)

## 원인
- 원인: `creditTotals`가 부가세를 과세 공급가액 합계에 한 번만 반올림해 매겨서, 팀 규칙(줄마다 버림한 값의 합)과 몇 원씩 어긋난다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`가 `Math.round(taxable * 10 / 100)` 사용. 17,438 × 10% = 1,743.8 → 1,744. 줄별 버림이면 1,742. 줄이 하나뿐이거나 줄 부가세가 정수인 전표는 어긋나지 않는다(기존 테스트 580원 통과). 수정 전후 테스트로 확인.
- 사람 추정 판정: 없음
- 기각한 가설: 할인 계산(`returnedDiscount`) 오류 — 공급가액 17,438원은 청구서 할인 규칙과 맞고 어긋남은 부가세에서만 생긴다.

## 변경 요약
- `src/invoice/total.js` — `lineVat(net, {taxable, zeroRated})` 추가: 줄 공급가액에 매겨 버림, 면세·영세율은 0. 이 브랜치에는 `lineVat`이 없어 새로 둠(앞 Work에서 이미 만들었을 수 있음).
- `src/invoice/credit-note.js` — `creditTotals`가 `lineVat`의 줄별 합으로 부가세를 계산. `creditNoteTotals`는 그대로(저장된 totals 우선). 청구서 계산(`computeTotals`)과 `src/format/`은 건드리지 않음.
- `test/credit-note.test.js` — 테스트 3개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/credit-note.test.js` — "CN-0112: 부가세는 줄마다 버림한 값의 합이다" (+ 영세율/면세 0, 저장 totals 유지)
- 수정 전: 실패 (`src`를 되돌리고 `npm test`: pass 48, fail 1 — CN-0112 테스트)
- 수정 후: 통과 (`npm test`: pass 49, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
