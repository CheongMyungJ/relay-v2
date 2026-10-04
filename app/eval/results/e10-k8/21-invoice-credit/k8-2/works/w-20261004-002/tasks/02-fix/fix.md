## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`으로 `createCreditNote`를 호출해 `totals`를 출력 (스크래치 스크립트, `node /tmp/r.mjs`)
- 결과: 재현됨
- 기대: 부가세 = 줄별 버림 합 923 + 612 + 207 = 1,742원, 합계 19,180원
- 실제: 부가세 1,744원, 합계 19,182원 (공급가액 17,438원은 정상)

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 10%를 매겨 `Math.round`로 한 번만 반올림했다. 팀 규칙은 줄마다 버림한 값의 합이다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`에서 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 17,438 × 10% = 1,743.8이라 1,744가 나왔다. 줄별 버림이면 1,742다. 수정 뒤 같은 입력에서 1,742 / 19,180이 나온다. 줄 금액이 10원 단위이면 두 방식이 같아 기존 테스트가 통과했다.
- 이 브랜치에는 `computeVat`(`src/invoice/vat.js`)이 없어(앞 Work w-20261004-001 브랜치에만 있음) 같은 내용으로 만들었다.
- 사람 추정 판정: 없음
- 기각한 가설: 할인 분할 반올림이 원인 — `returnedDiscount`는 청구서의 `lineDiscount`와 같은 반올림(`Math.round`)이고 CN-0112에서 공급가액 17,438원은 규칙과 맞아 부가세만 어긋났다.

## 변경 요약
- `src/invoice/vat.js` — 신규. `computeVat(rows, zeroRated)`: 과세 줄별 `Math.floor(net × 10%)`의 합, 영세율이면 0. 앞 Work 브랜치의 파일과 같은 내용이라 머지 때 충돌하지 않게 했다.
- `src/invoice/credit-note.js` — `creditTotals`가 `computeVat`을 쓰도록 바꾸고 안 쓰는 `VAT_RATE_PERCENT` import를 지웠다. `creditNoteTotals`는 이미 저장된 `totals`를 우선 돌려줘 그대로 뒀다.
- `test/credit-note.test.js` — 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/credit-note.test.js`의 '반품 전표 부가세는 과세 줄마다 버림한 값의 합이다' (905×7, 1085×3 − 500 할인, 345×9, 면세 줄 포함), 영세율 테스트, 저장된 totals 테스트
- 수정 전: 실패 (`credit-note.js`만 되돌리고 `node --test test/credit-note.test.js`: vat 1220 ≠ 기대 1218, 1 fail)
- 수정 후: 통과 (같은 명령: 8 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 49 pass, 0 fail
- 실패 항목: 없음
