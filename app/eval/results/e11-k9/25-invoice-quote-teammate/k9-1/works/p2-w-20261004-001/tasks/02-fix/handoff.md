---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재현되지 않으므로 코드를 바꾸지 않고 관찰 사실만 기록한다"
    why: "사람이 quote.js 직접 실행과 테스트 범위 확인을 요청했고 확인한 결과 현재 코드는 56,278원이다"
    by: human
assumptions:
  - "문의된 56,280원은 e74d721 이전 코드로 발행된 견적서의 값이라고 추정함. 발행 시점의 코드는 확인하지 못함"
rejected:
  - "줄 금액·할인 계산이 원인: 줄별 공급가가 손계산과 일치하고 이전·현재 코드의 공급가액이 같다"
  - "테스트가 청구서 로직만 검증한다: test/quote.test.js는 createQuote로 견적 경로를 직접 검증한다"
open_questions: []
intent_deviation:
  summary: "의도의 전제(현재 합계 56,280원)가 기준 커밋에서 성립하지 않는다"
  evidence: "node src/cli.js examples/Q-0457.json → vat 3587, total 56278. 56,280은 e74d721^에서만 나온다"
risks:
  - "이미 56,280원으로 나간 견적서는 이 수정으로 바뀌지 않는다. 발행 후 재계산 여부는 별도 확인이 필요하다"
  - "코드 변경이 없어 새 커밋이 없다"
  - "CN-0112 부분 반품의 비율 할인은 Math.round로 반올림한다(credit-note.js returnedDiscount). 형광펜 3개 할인 322.5원이 323원이 되며, 경리가 할인도 버림으로 계산하면 합계가 1원 다를 수 있다. 확인하지 않았고 코드는 바꾸지 않았다"
recommended_next: null
knowledge_candidates:
  - "Q-0457 견적 합계의 규정값은 공급가액 52,691, 부가세 3,587, 합계 56,278이다. 합계에서 한 번 반올림하면 3,589/56,280으로 틀린다"
---
## 요약
Q-0457 합계 56,280원은 기준 커밋에서 재현되지 않는다. 현재 `quote.js`는 56,278원을 낸다. 56,280원은 e74d721 이전의 합계 반올림 코드에서만 나오며 그 커밋이 이미 고쳤다. 코드 변경은 없다.
## 다음 task가 알아야 할 것
- 확인 명령: `node src/cli.js examples/Q-0457.json` (vat 3587, total 56278)
- 이전 동작 재현: `git archive e74d721^`를 풀어 같은 입력 실행 → vat 3589, total 56280
- 테스트: `test/quote.test.js`의 Q-0457 테스트가 `createQuote` 경로를 검증한다. `npm test` 56개 통과
- 코드 변경과 커밋 없음. verify는 변경 없음을 전제로 검토하고, 이미 나간 56,280원 견적서 처리는 사람의 판단이 필요하다
