## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`을 `createCreditNote`로 적용해 `totals`를 출력한다.
- 결과: 재현됨
- 기대: 줄별 버림 합산 부가세 923+612+207 = 1,742원, 환불 합계 19,180원
- 실제: 부가세 1,744원, 환불 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세 합계(17,438)에 한 번만 곱해 `Math.round`(1,743.8→1,744)했다. 회계 규정은 줄마다 버림해 합산한다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 vat 줄. 수정 후 같은 입력이 1,742원이 되고 수정 전 새 테스트가 실패함. 줄 net 9,236 / 6,127 / 2,075 → 923 / 612 / 207.
- 사람 추정 판정: 없음
- 기각한 가설: 없음. (팀 지식의 `vatOfLines`는 이 브랜치에 없어 `src/money.js`에 새로 만들었다. 앞 Work 머지 시 충돌 가능.)

## 변경 요약
- src/money.js — 공용 `vatOfLines(rows, percent, zeroRated)` 추가: 과세 줄마다 net×세율 버림 합산, 영세율 0, 면세 줄 제외
- src/invoice/credit-note.js — `creditTotals`가 `vatOfLines`를 쓰게 변경. 저장된 `totals`를 쓰는 `creditNoteTotals`는 그대로
- test/credit-note.test.js — 테스트 2개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js (CN-0112 / INV-2047, 영세율·면세)
- 수정 전: 실패 (`npm test` → 1 fail, vat 1744 ≠ 1742)
- 수정 후: 통과 (`npm test` → 50 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 통과, 0 실패
- 실패 항목: 없음
