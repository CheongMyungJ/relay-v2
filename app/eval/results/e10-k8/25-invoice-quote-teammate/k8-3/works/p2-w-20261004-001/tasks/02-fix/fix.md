## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(m=>console.log(m.createQuote(JSON.parse(require('fs').readFileSync('examples/Q-0457.json'))).totals))"`, 이어서 `npm test`
- 결과: 재현 안 됨 (견적서 합계). 기준 커밋(889d249)에서 이미 규칙대로 계산된다. 사람에게는 묻지 않고 관찰 사실만으로 진행했다(초안 우선).
- 기대: 줄별 버림 규칙 합계 — 부가세 995+841+886+865 = 3,587원, 합계 56,278원
- 실제: 견적 합계 `{supply: 52691, taxable: 35891, exempt: 16800, vat: 3587, total: 56278}`. 의도에 적힌 56,280원(합계 반올림 3,589원)은 나오지 않는다. 대신 `npm test`에서 반품 전표 테스트 6건이 `VAT_RATE_PERCENT is not defined`로 실패한다.

## 원인
- 원인: 견적서 쪽 수정(커밋 07c2ebc, `quoteTotals`가 `lineVat` 사용)은 이미 기준 브랜치에 들어 있다. 56,280원은 그 수정 전 값이다. 남은 문제는 w-20261004-002 머지 때 `creditTotals`가 `lineVat`를 import하면서도 `Math.floor((r.net * VAT_RATE_PERCENT)/100)`를 남겨, import하지 않은 `VAT_RATE_PERCENT`를 참조한 것이다.
- 근거: `git log -- src/invoice/quote.js`에 07c2ebc가 있음. `src/invoice/credit-note.js:94`가 `VAT_RATE_PERCENT`를 쓰는데 1~5줄 import에 없음. 스택 트레이스가 같은 줄을 가리킴. 수정 후 6건이 모두 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 견적서 `quoteTotals`/`lineDiscount`의 계산 오류 — `quoteTotals`가 `lineVat`를 쓰고 직접 계산한 값과 일치함

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`가 `lineVat(r.net)`를 쓰게 함. 정의되지 않은 `VAT_RATE_PERCENT` 참조를 없애고 팀 지식(`vat-per-line-floor.md`)의 "lineVat 사용" 규칙을 따름. 결과 값은 이전 줄별 버림과 같다.
- test/quote.test.js — Q-0457 합계 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/quote.test.js "견적 Q-0457 합계는 줄별 버림 규칙으로 직접 계산한 값과 같다"; 반품 쪽은 기존 test/credit-note.test.js 6건이 재현 역할
- 수정 전: 견적 Q-0457 테스트는 이미 통과한다(견적서는 수정 전에도 정상이라 실패하는 재현 테스트를 만들 수 없음). `npm test`는 47 통과 / 6 실패(반품 전표, `VAT_RATE_PERCENT is not defined`).
- 수정 후: `npm test` 54 통과 / 0 실패 (Q-0457 테스트 포함)

## 테스트 실행
- 명령: `npm test`
- 결과: tests 54, pass 54, fail 0
- 실패 항목: 수정 전 6건은 기준 커밋(889d249)에서도 실패했고, 이번 수정으로 해결됨. 수정 뒤 실패 없음
