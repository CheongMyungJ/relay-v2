## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(m=>console.log(m.createQuote(JSON.parse(require('fs').readFileSync('examples/Q-0457.json'))).totals))"`, `npm test`
- 결과: 재현됨
- 기대: Q-0457 합계 = 공급가액 52,691 / 과세 35,891 / 면세 16,800 / 부가세 3,587 / 합계 56,278 (줄별 손계산: 995+841+886+865)
- 실제: 기준 커밋에서 `TypeError: 금액은(는) 정수 원이어야 한다: [object Object]`. `npm test` 42개 중 19개 실패

## 원인
- 원인: 3cccc30이 `sumLineVat`을 "과세 줄 net 숫자 배열" 입력으로 바꾸고 credit-note.js만 맞췄다. quote.js:39와 total.js:26은 옛 시그니처대로 줄 객체 배열을 넘겨 TypeError가 났고, 면세 줄 제외도 빠졌다.
- 근거: `git show 71e323f`(rows 받는 sumLineVat)와 `git show 3cccc30`(nets 받는 sumLineVat, credit-note만 수정). src/invoice/vat.js:12. 호출부를 고치자 52개 전부 통과. 청구서 쪽 실패는 issueInvoice가 computeTotals를 부르는 연쇄 실패이고 기준 커밋 0fc8b31에서 이미 실패했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/invoice/quote.js — `sumLineVat`에 과세 줄 net 배열을 넘김
- src/invoice/total.js — 같은 호출 오류 수정(사람이 범위에 포함하기로 선택). 계산 규칙은 그대로, 저장된 합계는 건드리지 않음

## 재현 테스트
- 위치: test/quote.test.js `견적 부가세는 할인된 줄 금액에 줄마다 내림해 합산한다` (Q-0457과 같은 품목, 손계산 값). 새로 추가하지 않고 기존 테스트가 이미 이 값을 기대함
- 수정 전: 실패 (`npm test`, 위 TypeError)
- 수정 후: 통과 (`npm test` 52 pass / 0 fail)

## 테스트 실행
- 명령: npm test
- 결과: 52 통과, 0 실패
- 실패 항목: 없음 (수정 전 19개 실패는 기준 커밋에서도 실패)
