---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`creditTotals`의 부가세를 `sumLineVat`으로 바꾼다"
    why: "팀 지식 docs/knowledge/billing/vat-per-line-floor.md: 모든 문서가 공용 함수를 쓴다"
    by: ai
  - what: "새 테스트를 추가하지 않고 기존 Q-0457, CN-0112 테스트를 재현 테스트로 쓴다"
    why: "이미 같은 값을 단언하고 수정 전 실패, 수정 후 통과를 확인함"
    by: ai
assumptions:
  - "56,280원은 코드 밖에서 나온 값이라고 가정함. 확인 안 됨"
rejected:
  - "견적 합계 계산이 56,280원을 냄: CLI와 createQuote 모두 56,278원이고 해당 경로가 코드에 없음"
open_questions: []
intent_deviation: null
risks:
  - "56,280원의 출처는 풀리지 않았다. 견적 코드는 바뀐 것이 없다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/billing/vat-per-line-floor.md — `creditTotals`가 `sumLineVat`을 쓰도록 고쳐 '아직 규칙을 따르지 않는 곳' 항목을 없앤다"
  - "반품 전표 부가세 계산에서 상수를 직접 참조하다 import 누락으로 ReferenceError가 났다. 부가세는 항상 `lineVat`/`sumLineVat`을 쓴다"
---
## 요약
반품 전표 `creditTotals`가 import 없는 `VAT_RATE_PERCENT`를 써서 실패하던 것을 `sumLineVat`으로 바꿔 고쳤다. `npm test` 58건 모두 통과. 견적 Q-0457은 원래 56,278원이라 코드 변경이 없다.
## 다음 task가 알아야 할 것
- 변경: `src/invoice/credit-note.js` `creditTotals` (커밋 1개)
- 검증: `npm test` 58/58, `node src/cli.js examples/Q-0457.json` → 56278
- Q-0457과 CN-0112 단언은 기존 `test/vat-rule.test.js:55,60`에 있음
