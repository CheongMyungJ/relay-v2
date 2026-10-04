## 재현
- 재현 절차: 워크트리에서 `INV-2047.json`과 `CN-0112.json`으로 `createCreditNote(invoice, data).totals`를 계산한다 (`examples/` 기준).
- 결과: 재현됨
- 기대: vat 1,742 / total 19,180
- 실제: vat 1,744 / total 19,182

## 원인
- 원인: `creditTotals`가 과세분 공급가액 합계에 `Math.round`로 부가세를 한 번 계산했다. 규칙은 줄마다 원 미만 절사 후 합산이다.
- 근거: `src/invoice/credit-note.js`의 vat 계산. 줄별 부가세는 923(9,236) + 612(6,127) + 207(2,075) = 1,742이고, 합계 17,438 × 10% = 1,743.8을 반올림하면 1,744. 수정 뒤 19,180이 나옴.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — `lineVat(net)` 추가(공급가액 × 세율, 원 미만 절사). 팀 지식의 앞 Work에서 만든 `lineVat`이 이 브랜치에 없어 같은 이름으로 추가했다.
- `src/invoice/credit-note.js` — vat를 과세 줄마다 `lineVat`을 합산하도록 변경. 영세율은 0, 면세 줄은 제외, 저장된 `totals`는 그대로 반환(기존 동작 유지). 안 쓰는 `VAT_RATE_PERCENT` import 제거.

## 재현 테스트
- 위치: `test/credit-note.test.js` (CN-0112 테스트, 영세율/저장 totals 테스트)
- 수정 전: 실패 (`node --test test/credit-note.test.js` — CN-0112 테스트 실패, vat 1744)
- 수정 후: 통과 (`npm test` — 50개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 통과, 0 실패
- 실패 항목: 없음
