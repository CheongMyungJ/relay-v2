## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(m=>console.log(m.createQuote(JSON.parse(require('fs').readFileSync('examples/Q-0457.json'))).totals))"`, 그리고 `npm test`
- 결과: 재현 안 됨 (견적서). 사람의 선택: 관찰 사실만으로 진행
- 기대: Q-0457 합계 56,278원
- 실제: 기준 커밋(50b1829)에서 이미 56,278원 (supply 52,691, vat 3,587). 대신 `npm test`는 6건 실패(반품 전표, `VAT_RATE_PERCENT is not defined`)

## 원인
- 원인: 견적서 버그는 cb2f714에서 `quote.js`가 줄별 버림(`lineVat`)으로 이미 고쳐져 있다. 별개로 `credit-note.js:93`이 import 없이 `VAT_RATE_PERCENT`를 써서 ReferenceError가 난다.
- 근거: `src/invoice/quote.js` quoteTotals가 `lineVat(r.net)` 사용, 위 명령 출력 56,278원. `grep VAT_RATE_PERCENT src`에서 credit-note.js에는 import가 없음. 수정 후 60개 전부 통과. 기준 커밋에서도 6건 실패(실험: 한 줄 수정 뒤 사라짐).
- 사람 추정 판정: 없음
- 기각한 가설: 견적서 quote.js에 남은 반올림 문제 — 코드와 실행 결과가 이미 규칙대로임

## 변경 요약
- src/invoice/credit-note.js — 93줄의 `Math.floor((r.net * VAT_RATE_PERCENT) / 100)`을 이미 import된 `lineVat(r.net)`으로 바꿈. 값은 같고 미정의 참조만 제거(범위 확장은 사람이 승인).

## 재현 테스트
- 위치: 견적서는 이미 있는 `test/vat-per-line.test.js`의 "견적서 부가세는 줄별 원 단위 버림의 합 (Q-0457)". 반품 전표 실패는 기존 `test/credit-note.test.js`, `test/vat-per-line.test.js`(CN-0112)가 재현
- 수정 전: 견적서 테스트는 이미 통과(재현 안 됨). 반품 전표 테스트 6건 실패 (`npm test`, `VAT_RATE_PERCENT is not defined`)
- 수정 후: 통과 (`npm test`, 60개 중 60 통과)
- 새 테스트는 추가하지 않음: 기존 테스트가 두 경우를 모두 덮는다

## 테스트 실행
- 명령: `npm test`
- 결과: 60개 통과, 0 실패
- 실패 항목: 수정 전 6건은 기준 커밋에서도 실패했고, 이번 수정으로 해소
