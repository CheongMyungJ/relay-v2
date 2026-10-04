## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(async m=>{const fs=await import('fs');console.log(m.createQuote(JSON.parse(fs.readFileSync('examples/Q-0457.json'))).totals)})"`, 그리고 `npm test`
- 결과: 재현 안 됨 (사람의 선택: 관찰 사실만으로 진행). 대신 `npm test`가 5건 실패하는 별도 결함을 확인함
- 기대: Q-0457 합계 56,278원, `npm test` 전부 통과
- 실제: Q-0457은 이미 `{ supply: 52691, taxable: 35891, exempt: 16800, vat: 3587, total: 56278 }`. `npm test`는 53건 중 5건 실패(`VAT_RATE_PERCENT is not defined`, 반품 전표 테스트)

## 원인
- 원인: 견적서는 a8348c6에서 이미 `vatOfRows`(줄별 버림 합)를 쓰도록 바뀌어 있어 56,278원이 나온다(56,280원은 옛 합계 기준 반올림 값으로 추정). `npm test` 실패는 973c90c가 `credit-note.js`에 `VAT_RATE_PERCENT`를 쓰면서 import를 빠뜨려서 생겼다.
- 근거: `src/invoice/quote.js:38`이 `vatOfRows` 사용, 위 출력. `src/invoice/credit-note.js:86`이 `VAT_RATE_PERCENT`를 쓰는데 1줄 import에 없었음. import 추가 뒤 53/53 통과(실험 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 견적서 코드가 합계 기준 반올림을 쓴다 — 현재 코드와 출력이 56,278원으로 이미 줄별 버림. / 56,278원이 줄별 버림 규칙에서 나온 값인지 — 줄별 버림 결과가 정확히 56,278원(vat 3,587)이라 일치함(단, 회계팀의 공식 확인은 아님)

## 변경 요약
- src/invoice/credit-note.js — `VAT_RATE_PERCENT` import 추가. 계산 로직과 저장된 totals 처리는 바꾸지 않음
- 견적서(`quote.js`), `src/format/`, 기존 테스트는 바꾸지 않음

## 재현 테스트
- 위치: 기존 `test/credit-note.test.js` (반품 전표 부가세는 과세 줄마다 원 단위 버림의 합이다 (CN-0112) 외 4건), 견적서는 `test/quote.test.js`(Q-0457)
- 수정 전: 실패 (`npm test` → 53건 중 5건 실패, `VAT_RATE_PERCENT is not defined`)
- 수정 후: 통과 (`npm test` → 53건 모두 통과)
- 새 테스트는 추가하지 않음: 실패하던 기존 테스트가 이미 이 결함을 잡는다

## 테스트 실행
- 명령: `npm test`
- 결과: 53 pass / 0 fail
- 실패 항목: 수정 전 5건은 기준 커밋(2c90d84)에서도 실패했음. 이번 수정 뒤 실패 없음
