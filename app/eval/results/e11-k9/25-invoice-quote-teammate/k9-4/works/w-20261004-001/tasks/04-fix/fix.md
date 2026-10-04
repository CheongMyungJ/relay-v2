## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`, `node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json`, `node src/cli.js examples/Q-0457.json`
- 결과: 재현됨
- 기대: INV-2031 부가세 2,641원·합계 29,079원. 반품 전표와 견적서도 줄별 내림 합
- 실제: INV-2031 부가세 2,644원·합계 29,082원. CN-0112 부가세 1,744원, Q-0457 부가세 3,589원

## 원인
- 원인: 부가세를 과세 공급가액 합계에 한 번만 반올림해 계산했다. 줄별 내림 합보다 커질 수 있다. 견적서는 할인 전 금액에 부가세를 매기고 할인분 부가세를 빼는 별도 방식이라 할인된 줄 금액 기준과도 달랐다.
- 근거: `src/invoice/total.js`의 `Math.round(taxable*10/100)`, `src/invoice/credit-note.js`의 같은 식, `src/invoice/quote.js`의 gross/discount별 `percentOf` 차. 수정 후 INV-2031 2,641원(기대와 일치). 수정 전 코드로 되돌리면 새 테스트 3개 실패.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계에 한 번 반올림하는 방식이 줄별 내림 합과 어긋난다.
- 기각한 가설: 없음

## 변경 요약
- src/invoice/vat.js (신규) — `lineVat`(줄 공급가액의 10%를 내림)과 `sumLineVat`(과세 줄 합산, 영세율 0). 세 곳이 같은 규칙을 쓰게 함
- src/invoice/total.js — 부가세를 `sumLineVat`으로 계산
- src/invoice/credit-note.js — 반품 전표 부가세를 `sumLineVat`으로 계산(반품 할인 적용 뒤 줄 금액 기준)
- src/invoice/quote.js — 견적 부가세를 할인된 줄 금액 기준 줄별 내림 합으로 계산
- 발행된 청구서 저장 합계 경로(`invoiceTotals`, `creditNoteTotals`)와 `src/format/`은 건드리지 않음. 서식 출력은 금액 값만 달라지고 줄 구성은 같음(diff로 확인).
- 기존 테스트 변경 없음

## 재현 테스트
- 위치: test/total.test.js (INV-2031), test/quote.test.js (Q-0457형 할인 견적), test/credit-note.test.js (홀수 단가 반품)
- 수정 전: 실패 (src 변경을 임시로 되돌리고 `npm test` → 3개 실패, 48 통과)
- 수정 후: 통과 (`npm test` → 51개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: 51개 통과, 0 실패
- 실패 항목: 없음
