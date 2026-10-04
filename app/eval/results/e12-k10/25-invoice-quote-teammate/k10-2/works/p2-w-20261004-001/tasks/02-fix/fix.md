## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(m=>console.log(m.createQuote(JSON.parse(require('fs').readFileSync('examples/Q-0457.json'))).totals))"` 또는 `node --test test/quote.test.js`
- 결과: 재현됨 (단, 증상이 요청과 다름)
- 기대: totals.total 56,278원 (vat 3,587)
- 실제: 56,280원 값은 나오지 않고 `TypeError: 금액은(는) 정수 원이어야 한다: NaN` (sumWon, quote.js:42)로 예외. 청구서 계산(`computeTotals`)도 같은 이유로 실패해 `npm test` 17건 실패.

## 원인
- 원인: `quoteTotals`와 `computeTotals`가 `rows.map(lineVat)`로 행 객체를 `lineVat(net)`에 넘겨(`net * rate`가 NaN) 줄별 부가세가 NaN이 된다. 반품 전표(`credit-note.js:91`)만 `lineVat(r.net)`으로 올바르게 호출했다.
- 근거: `src/invoice/quote.js:42`, `src/invoice/total.js:31`. 실행 결과 NaN 예외. `lineVat(r.net)`으로 바꾸자 47건 통과로 바뀜. 56,280은 합계 기준 반올림 값(이전 구현)으로, 현 코드에서는 나오지 않음.
- 사람 추정 판정: 없음 (intake의 AI 가설 "행 객체를 넘김"은 맞음)
- 기각한 가설: 없음

## 변경 요약
- src/invoice/quote.js — `lineVat(r.net)`으로 호출
- src/invoice/total.js — 같은 호출 오류 수정 (같은 `lineVat`을 쓰는 청구서, 팀 지식 규칙 범위이며 npm test 실패의 원인)
- (기존 테스트 변경) test/credit-note.test.js — 중복된 `readFileSync` import 한 줄 삭제 (SyntaxError로 파일이 로드되지 않았음, 단언은 그대로)

## 재현 테스트
- 위치: test/quote.test.js "견적 부가세는 할인 반영 후 ... (Q-0457)" (이미 있던 테스트, 새로 추가하지 않음)
- 수정 전: 실패 — `node --test test/quote.test.js` → pass 1 / fail 3
- 수정 후: 통과 — `npm test` → pass 54 / fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 54 통과, 0 실패
- 실패 항목: 수정 전 18건은 모두 기준 커밋에서도 실패(원인 위 두 가지). 이번 수정 뒤 실패 없음
