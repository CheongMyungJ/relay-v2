## 재현
- 재현 절차: `examples/INV-2031.json`을 `createInvoice`로 만들어 `computeTotals`를 호출한다 (`node /tmp/r.mjs` 형태의 스크립트).
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 `Math.round`를 한 번만 적용해(26,438×10% = 2,643.8 → 2,644) 줄별 버림 합(2,641)보다 커졌다.
- 근거: `src/invoice/total.js` 수정 전 vat 줄. 줄별 부가세 536+633+325+837+310 = 2,641. 줄 단위 버림으로 바꾸자 29,079가 나옴(실험 확인).
- 사람 추정 판정: 요청자는 반올림 문제라고 짐작 — 맞음(부분적으로). 합계에 한 번 반올림하는 것이 원인이고, 줄별 버림으로 바꾸는 것이 해법이다.
- 기각한 가설: 발행된 청구서가 다시 계산된다 — `invoiceTotals`(src/invoice/invoice.js)는 draft가 아니고 저장된 totals가 있으면 그대로 쓰므로 재계산되지 않음.

## 변경 요약
- src/invoice/total.js — 부가세를 과세 줄마다 `Math.floor(net×세율/100)`로 계산해 합산. 영세율은 0 유지, 면세 줄은 제외.
- test/total.test.js — 재현 테스트 2개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/total.test.js 마지막 2개 테스트(INV-2031 값, 할인·면세 혼합)
- 수정 전: 실패 (`npm test` → 46 통과, 2 실패)
- 수정 후: 통과 (`npm test` → 48 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 48개 모두 통과
- 실패 항목: 없음
