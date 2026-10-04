## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(m=>console.log(m.createQuote(JSON.parse(require('fs').readFileSync('examples/Q-0457.json'))).totals))"` 를 현재 코드(3d7e9d4)와 옛 코드(`bc008ff^`를 `git archive`로 푼 사본)에서 각각 실행
- 결과: 현재 코드에서는 재현 안 됨. 옛 코드(bc008ff 이전)에서는 재현됨 (56,280). 현재 코드에서 재현 안 되는 까닭이 설명되므로 사람에게 되묻지 않고 진행함
- 기대: supply 52,691 / vat 3,587 / total 56,278 (줄별 버림: 995 + 841 + 886 + 865)
- 실제: 현재 코드 56,278 (기대와 같음). 옛 코드 vat 3,589 / total 56,280 (안내된 값과 같음)

## 원인
- 원인: 안내된 56,280은 bc008ff 이전의 견적 부가세 계산(할인 전 부가세 합 − 할인분 부가세, 각각 반올림)이 낸 값이다. 같은 Work에서 bc008ff가 이미 줄별 버림으로 고쳤고, 현재 `quoteTotals`는 규칙대로다.
- 근거: `src/invoice/quote.js:31-46`는 `Math.floor(net*10/100)`를 과세 줄마다 합산. 현재 코드 출력 56,278, 옛 코드 출력 56,280(vat 3,589 = 과세 합 35,891의 10%를 반올림한 값). 옛 코드 사본에서 새 테스트를 돌리면 실패하고 현재 코드에서는 통과(실험함).
- 사람 추정 판정: 없음
- 기각한 가설: 저장된 합계·examples·출력 경로가 56,280을 만든다 — 견적은 `createQuote`에서 `quoteTotals`로 계산한 값만 쓰고(src/cli.js:49-50) 다른 경로가 없음. `src/format/`은 견적에 쓰이지 않음.

## 변경 요약
- test/quote.test.js — Q-0457 합계 회귀 테스트 추가 (기존 테스트 변경 없음). 소스 코드는 이미 올바라 바꾸지 않음.

## 재현 테스트
- 위치: test/quote.test.js 마지막 테스트 (`examples/Q-0457.json` 사용)
- 수정 전: 실패 — 옛 코드(bc008ff^) 사본에서 `node --test test/quote.test.js` → 새 테스트 not ok (total 56,280). 현재 코드에는 "수정 전" 상태가 없음
- 수정 후: 통과 — 현재 코드에서 `npm test` 53개 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 53개 중 53개 통과, 실패 0
- 실패 항목: 없음
