## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용하고 `creditNoteTotals`를 출력한다 (`node /tmp/r.mjs` 형태의 스크립트).
- 결과: 재현됨
- 기대: vat 1,742원, total 19,180원
- 실제: vat 1,744원, total 19,182원

## 원인
- 원인: `creditTotals`가 부가세를 과세 공급가액 합계에 한 번 `Math.round`해서 구한다. 팀 규정은 줄마다 버림한 값의 합이다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 합계 17,438 × 10% = 1,743.8 → 1,744. 줄별 버림은 923 + 612 + 207 = 1,742. 수정 후 출력 1,742 / 19,180으로 확인했다. 줄 금액이 10의 배수이면 두 방식이 같아 재현되지 않는다.
- 사람 추정 판정: 없음
- 기각한 가설: 줄 공급가액(`creditLineAmounts`의 net) 계산 오류 — 줄별 net 9,236 / 6,127 / 2,075는 수동 계산과 일치해서 기각

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄별 `Math.floor(net × 세율 / 100)`의 합으로 바꿨다. 영세율은 계속 0, 면세 줄은 제외. `floorPercentOf`는 이 브랜치에 아직 없어(앞 Work 머지 대기) 같은 식을 인라인으로 썼다.
- test/credit-note.test.js — 테스트 3개 추가 (기존 테스트는 바꾸지 않음).

## 재현 테스트
- 위치: test/credit-note.test.js `반품 전표 부가세는 줄마다 버림한 합이다 (CN-0112)`
- 수정 전: 실패 (`node --test test/credit-note.test.js` — vat 1744, 기대 1742)
- 수정 후: 통과 (같은 명령, 8개 모두 통과)
- 면세·영세율 0 테스트와 저장된 totals 재사용 테스트도 추가했다 (수정 전에도 통과하는 회귀 방지용).

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
