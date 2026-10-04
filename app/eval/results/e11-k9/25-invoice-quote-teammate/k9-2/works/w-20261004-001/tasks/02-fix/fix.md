## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계에 `Math.round`로 부가세를 한 번만 계산해, 줄별 버림 합보다 몇 원 크게 나온다.
- 근거: `src/invoice/total.js`의 vat 계산(26,438×10% 반올림=2,644). 줄별 버림 합은 2,641(수정 후 CLI 출력). 수정하자 출력이 2,641로 바뀜(실험 확인).
- 사람 추정 판정: 없음
- 기각한 가설: `percentOf`(src/money.js)를 고친다 — `quote.js`도 쓰므로 견적서가 바뀌어 비목표 위반. 기각.

## 변경 요약
- src/invoice/total.js — 부가세를 과세 줄마다 `Math.floor(net×10/100)` 후 합산. 영세율은 0 유지.
- test/total.test.js — 테스트 2개 추가(기존 테스트 변경 없음).
- 발행 청구서는 `invoiceTotals`가 저장된 totals를 쓰므로 변경 없음. `src/format/`, 견적서, 반품 전표는 손대지 않음.

## 재현 테스트
- 위치: test/total.test.js 끝의 두 테스트(INV-2031, 면세·영세율 포함)
- 수정 전: 실패 (`npm test` — vat 기대 2641 실제 2644, 기대 210 실제 211)
- 수정 후: 통과 (`npm test` — pass 50, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
