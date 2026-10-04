## 재현
- 재현 절차: `node src/cli.js examples/Q-0457.json`, `npm test`
- 결과: 재현됨 (견적 쪽은 재현 안 됨, 반품 전표 쪽 실패만 재현됨)
- 기대: Q-0457 합계 56,278원, `npm test` 전부 통과
- 실제: Q-0457은 supply 52691 / vat 3587 / total 56278로 이미 경리와 같음(56,280원은 나오지 않음). `npm test`는 58건 중 7건 실패, 오류 `VAT_RATE_PERCENT is not defined`

## 원인
- 원인: `creditTotals`가 `lineVat`/`sumLineVat` 대신 줄별 `Math.floor`를 직접 계산하면서 import하지 않은 `VAT_RATE_PERCENT`를 참조해 ReferenceError가 난다.
- 근거: 스택 `src/invoice/credit-note.js:94` (`createCreditNote` → `creditTotals`). 같은 파일이 `sumLineVat`을 import만 하고 쓰지 않았다. `sumLineVat(rows, zeroRated)`로 바꾼 뒤 7건 모두 통과(실험 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 견적 합계 계산이 56,280원을 낸다 — CLI와 `createQuote` 모두 56,278원이고 코드에서 56,280원이 나오는 경로를 찾지 못함. 지어내 고치지 않음(비목표).

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 `sumLineVat(rows, note.zeroRated)`로 바꿈(팀 지식 vat-per-line-floor 규칙). `returnedDiscount`, `src/format/`, 저장된 `totals` 처리는 건드리지 않음.

## 재현 테스트
- 위치: test/vat-rule.test.js (기존 테스트: Q-0457 55행, CN-0112 60행 등). 새 테스트는 추가하지 않음. 이미 같은 값을 단언하는 테스트가 있고 이번 수정 전에 실패했기 때문
- 수정 전: 실패 (`npm test` → pass 51 / fail 7, `VAT_RATE_PERCENT is not defined`)
- 수정 후: 통과 (`npm test` → pass 58 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 58건 통과, 0건 실패
- 실패 항목: 수정 전 7건은 기준 커밋에서도 실패(같은 원인). 이번 수정 뒤 실패 없음
