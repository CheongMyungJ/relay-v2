## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계에 `Math.round`를 한 번 적용해, 줄마다 버림한 합(회계팀 규칙)보다 커진다.
- 근거: `src/invoice/total.js` 기존 vat 줄. INV-2031: 합계 기준 round(2643.8)=2644, 줄별 버림 536+633+325+837+310=2641. 수정 후 CLI 출력이 2641/29079로 바뀜(실험 확인).
- 사람 추정 판정: 반올림 문제로 보인다 — 맞음 — 합계 단위 반올림이 원인이다(줄별 버림이 아니라 합계에서 반올림하는 점).
- 기각한 가설: 없음

## 변경 요약
- src/invoice/total.js — 부가세를 과세 줄마다 `Math.floor(net*10/100)`로 계산해 합산. 영세율은 0 유지, 면세 줄 제외.
- test/total.test.js — 테스트 2개 추가(기존 테스트는 변경 없음).
- 발행된 청구서는 `invoiceTotals`가 저장 합계를 쓰므로(src/invoice/invoice.js:41) 손대지 않음. 견적서(quote.js)와 크레딧노트(credit-note.js)의 계산, `src/format/`은 비목표라 바꾸지 않음.

## 재현 테스트
- 위치: test/total.test.js (INV-2031 줄 테스트, 할인+면세 혼합 테스트)
- 수정 전: 실패 (`node --test test/total.test.js` → 2건 not ok)
- 수정 후: 통과 (`npm test` → 50 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 통과, 0 실패
- 실패 항목: 없음
