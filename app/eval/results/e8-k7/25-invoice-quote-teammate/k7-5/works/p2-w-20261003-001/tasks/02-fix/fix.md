## 재현
- 재현 절차: `node src/cli.js examples/Q-0457.json` (기준 커밋과 초기 커밋 973a500을 각각 실행), `npm test`
- 결과: 재현 안 됨 (현재 코드). 초기 커밋 973a500의 코드로는 재현됨. 사람에게는 묻지 않았다: 56,280원의 출처가 코드 안(옛 계산식)에서 확인되었다.
- 기대: vat 3,587 / total 56,278
- 실제: 기준 커밋(4d6c56b)은 이미 3,587 / 56,278. 973a500에서는 vat 3,589 / total 56,280. `npm test`는 55건 중 5건 실패(반품 전표).

## 원인
- 원인: 56,280원은 옛 `quoteTotals`가 과세 전체의 할인 전 금액과 할인액에 각각 한 번 반올림해 뺀 값이다(vat 3,589). 이 식은 8c0b9cc에서 이미 줄별 버림 합(`lineVat`)으로 바뀌었다. 남은 테스트 실패 5건은 90e0d19가 `credit-note.js`에서 import하지 않은 `VAT_RATE_PERCENT`를 참조해 생긴 ReferenceError다.
- 근거: 973a500을 풀어 실행하면 vat 3589, total 56280. 현재 `src/invoice/quote.js:30-46`은 `lineVat`을 쓰고 3587/56278. `npm test`의 5건 모두 `VAT_RATE_PERCENT is not defined` (`credit-note.js:94`). 수정 뒤 55/55 통과. 견적을 내는 경로는 `createQuote`→`quoteTotals` 하나뿐이다(grep).
- 사람 추정 판정: 없음
- 기각한 가설: 현재 코드에 별도 견적 합계 경로가 남아 있다 — `src/`에서 quote/vat를 쓰는 파일을 모두 확인했고 `quoteTotals` 외에 합계를 내는 곳이 없다. 저장된 합계(발행분)가 56,280원이다 — 견적은 저장 합계를 읽는 코드가 없고, 56,280원 견적서는 옛 코드가 만든 것으로 보인다(추정).

## 변경 요약
- src/invoice/credit-note.js — 줄별 부가세를 정의되지 않은 `VAT_RATE_PERCENT` 대신 이미 import된 `lineVat(r.net)`으로 계산해 ReferenceError를 없앰(규칙은 그대로).
- 견적 코드는 이미 고쳐져 있어 바꾸지 않았다.

## 재현 테스트
- 위치: test/quote.test.js (Q-0457, 8c0b9cc에서 추가), test/credit-note.test.js (CN-0112 포함 5건)
- 수정 전: 실패 — `npm test` 5건 실패 (`VAT_RATE_PERCENT is not defined`). Q-0457 테스트는 기준 커밋에서 이미 통과.
- 수정 후: 통과 — `npm test` 55/55 통과.
- 새 테스트는 추가하지 않았다: 기존 테스트가 이 결함을 이미 잡는다.

## 테스트 실행
- 명령: `npm test`
- 결과: 55건 중 55건 통과
- 실패 항목: 수정 전 5건은 기준 커밋에서도 실패했고, 이번 수정으로 모두 통과
