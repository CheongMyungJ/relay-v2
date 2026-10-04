## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`, `node src/cli.js examples/Q-0457.json`, `node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json`
- 결과: 재현됨
- 기대: INV-2031 합계 29,079원(vat 2,641), Q-0457 vat 3,587, CN-0112 vat 1,742
- 실제: INV-2031 합계 29,082원, Q-0457 vat 3,589, CN-0112 vat 1,744 (코드가 되감기로 기준 상태로 돌아와 세 가지 모두 재현됨)

## 원인
- 원인: 청구서와 반품 전표는 과세 공급가액 합계에 부가세를 한 번 반올림해 매기고(`Math.round`), 견적서는 할인 전 금액 합의 부가세에서 할인 합의 부가세를 빼서 계산했다. 줄별 버림 합이 아니라서 몇 원씩 차이가 났다.
- 근거: 수정 전 `src/invoice/total.js:28`, `credit-note.js` creditTotals, `quote.js` quoteTotals. 수정 전 실제 값은 위와 같고, 수정 후 CLI 출력이 기대값과 같다. 원래 코드로 되돌려 보니 새 테스트 4개가 실패했다.
- 사람 추정 판정: 반올림 문제로 보인다 — 맞음. 합계 단위 반올림이 원인이며, 견적서는 여기에 할인 전 금액 기준 계산이 더해졌다.
- 기각한 가설: 발행분 재계산 — `invoiceTotals`/`creditNoteTotals`가 저장된 totals를 쓰므로 해당 없음

## 변경 요약
- src/invoice/total.js — `vatOfRows` 추가(과세 줄별 `Math.floor` 합, 영세율 0). `computeTotals`가 사용
- src/invoice/credit-note.js — `creditTotals`가 `vatOfRows` 사용
- src/invoice/quote.js — `quoteTotals`가 `vatOfRows` 사용, 할인 전 금액 기준 계산 제거
- test/total.test.js, test/quote.test.js, test/credit-note.test.js — 테스트 추가만 있음(기존 테스트 변경 없음)
- `src/format/`과 발행분 저장 합계 로직은 변경 없음

## 재현 테스트
- 위치: test/total.test.js(INV-2031, 할인·면세 줄), test/quote.test.js(Q-0457과 영세율), test/credit-note.test.js(CN-0112, 저장 합계 유지)
- 수정 전: 실패 (src를 되돌리고 `npm test`: 48 통과, 4 실패)
- 수정 후: 통과 (`npm test`: 52 통과, 0 실패)

## 테스트 실행
- 명령: `npm test`
- 결과: 52개 모두 통과
- 실패 항목: 없음
