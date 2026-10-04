## 재현
- 재현 절차: `examples/INV-2047.json`과 `examples/CN-0112.json`을 읽어 `createCreditNote(invoice, data).totals`를 출력 (node, ESM)
- 결과: 재현됨
- 기대: 줄별 버림 부가세 923+612+207 = 1,742원, 환불 합계 19,180원
- 실제: 부가세 1,744원, 환불 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계(17,438)에 `Math.round`를 적용해 부가세를 구했다. 팀 규칙은 줄마다 버림해 합하는 것이다.
- 근거: `src/invoice/credit-note.js` 부가세 계산 줄. round(1743.8)=1744 대 줄별 floor(923.6, 612.7, 207.5)=1742. 수정 전 출력 19,182가 요청의 "현재 19,182원"과 일치. 수정 전 코드로 되돌리면 새 테스트가 실패하고 수정하면 통과(실험함). 저장된 totals 경로(`creditNoteTotals`)는 건드리지 않음.
- 사람 추정 판정: 없음
- 기각한 가설: 금액 할인 안분(`returnedDiscount`)의 Math.round가 원인 — CN-0112의 금액 할인 줄(박스테이프)은 전량 반품이라 안분이 없고, 비율 할인 322.5→323 반올림은 intent가 부가세 규칙만 다루므로 바꾸지 않음. 이 반올림을 버림으로 바꾸면 값이 달라질 수 있으나 회계 기준이 주어지지 않았다.

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)` 후 합산으로 변경. 영세율은 0 유지, 면세 줄 제외.
- test/credit-note.test.js — 테스트 2개 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js "반품 부가세는 줄마다 원 단위 버림으로 합한다 (CN-0112)", "저장된 totals가 있는 반품 전표는 다시 계산하지 않는다"
- 수정 전: 실패 (소스만 되돌리고 `npm test`: not ok 6, pass 47 / fail 1)
- 수정 후: 통과 (`npm test`: pass 48 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 통과, 0 실패
- 실패 항목: 없음
