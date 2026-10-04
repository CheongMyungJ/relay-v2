## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(async m=>{const fs=await import('fs');console.log(m.createQuote(JSON.parse(fs.readFileSync('examples/Q-0457.json'))).totals)})"`, 이어서 `npm test`
- 결과: 현재 코드에서는 재현 안 됨. 4307e8a 이전 코드(`git worktree add --detach <경로> 4307e8a^` 후 `node src/cli.js examples/Q-0457.json`)에서는 재현됨. 현재 코드는 `quoteTotals` 직접 호출, `createQuote`, `src/cli.js`, `src/index.js` 내보내기 경로 모두 56,278원이다. 견적 합계를 출력하는 다른 경로는 없다.
- 기대: 합계 56,278원
- 실제: 4307e8a^에서 vat 3,589 / total 56,280원. 현재(기준 커밋)는 supply 52,691 / vat 3,587 / total 56,278원. 56,280원은 나오지 않는다. 대신 `npm test`가 5건 실패했다(반품 전표, `VAT_RATE_PERCENT is not defined`).

## 원인
- 원인: 견적 코드(`src/invoice/quote.js:42`)는 이미 `lineVat`으로 줄마다 버림 합산한다(커밋 4307e8a). 56,280원은 4307e8a 이전의 합계 단위 부가세 계산(과세 합 35,891원의 10% = 3,589원) 결과이고, 줄마다 버림(995+841+886+865 = 3,587원)으로 바꾼 4307e8a가 이미 고쳤다. 별개로 반품 전표 `creditTotals`가 머지 뒤 `VAT_RATE_PERCENT` import 없이 그 이름을 써서 ReferenceError가 난다(4307e8a는 import를 `lineVat`으로 바꿨고 4686c79는 옛 인라인 식을 다시 넣었다).
- 근거: Q-0457 줄별 net·부가세 합 3,587원(면세 BK-1680은 0원). `src/invoice/credit-note.js:94`가 import되지 않은 `VAT_RATE_PERCENT`를 참조. 수정 전 `npm test` 49 pass / 5 fail, 수정 후 55 pass(테스트 1건 추가). 4307e8a^ 체크아웃 실험: vat 3,589 / total 56,280원, 4307e8a: 56,278원. 영업팀이 본 56,280원은 이 수정 전 빌드(배포본)에서 나온 값으로 보이며, 어느 배포본인지는 확인 못 함. 참고: 줄 정규화 없이 `quoteTotals(원본 JSON)`을 부르면 taxType이 없어 면세로 보고 52,691원이 나오지만 56,280원은 아니다.
- 사람 추정 판정: 없음
- 기각한 가설: 현재 코드의 다른 경로(CLI, index 내보내기, 정규화 전 입력)가 56,280원을 낸다 — 모두 실행해 56,278원 또는 52,691원이었다

## 변경 요약
- src/invoice/credit-note.js — 반품 전표 부가세를 `sumWon(rows.map(lineVat))`로 바꿈. 이미 import된 공용 `lineVat`을 써서 청구서·견적과 규칙을 맞추고 ReferenceError를 없앰. 면세 줄 0원, 영세율 0원은 그대로. 저장된 합계는 건드리지 않음.
- test/quote.test.js — Q-0457 합계 테스트 추가(기존 테스트는 바꾸지 않음).

## 재현 테스트
- 위치: test/quote.test.js의 'Q-0457 합계는 경리 계산과 같다', 반품 전표 쪽은 기존 test/credit-note.test.js
- 수정 전: 반품 전표 테스트 5건 실패(`npm test`, VAT_RATE_PERCENT is not defined). Q-0457 테스트는 수정 전에도 통과한다(견적은 이미 맞음). 그래서 Q-0457 테스트는 회귀 방지용이다.
- 수정 후: 통과 (`npm test` 55 pass / 0 fail)

## 테스트 실행
- 명령: npm test
- 결과: 55 tests, 55 pass, 0 fail
- 실패 항목: 기준 커밋에서 실패한 5건(반품 전표)이 이번 수정으로 통과. 이번 수정 뒤 실패 없음
