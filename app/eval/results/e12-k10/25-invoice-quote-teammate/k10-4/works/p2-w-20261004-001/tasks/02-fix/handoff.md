---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재현 없이 진행하고 소스 코드는 바꾸지 않는다. Q-0457 예제 파일 기반 테스트만 추가"
    why: "기준 커밋에서 이미 56,278원이다. 사람이 다른 경로를 다시 확인하라고 해서 확인했고 결과는 같았다"
    by: ai
assumptions:
  - "거래처가 본 56,280원은 ba89ca0 이전 배포본이나 이미 만든 견적서에서 나온 값이라고 본다"
rejected:
  - "견적 생성/출력에 별도 합계 계산 경로가 있다: createQuote와 CLI뿐이고 모두 quoteTotals를 쓴다"
  - "현재 코드가 56,280원을 낸다는 사람 추정: 틀림, 실제 56,278원"
open_questions: []
intent_deviation:
  summary: "intent는 현재 코드에서 합계가 56,280원이라고 전제하지만 기준 커밋에서는 이미 56,278원이다"
  evidence: "node src/cli.js examples/Q-0457.json → total 56278. ba89ca0~1에서만 56280"
risks:
  - "이미 56,280원으로 발송·저장된 견적서가 있으면 이 변경으로 바뀌지 않는다"
  - "추가한 테스트는 수정 전 실패를 보일 수 없다(이미 고쳐진 상태)"
recommended_next: null
knowledge_candidates: []
---
## 요약
Q-0457 견적 합계 56,280원은 ba89ca0 이전의 부가세 계산에서만 나온다. 기준 커밋은 이미 56,278원이다. 소스는 바꾸지 않고 예제 파일 기반 테스트 1건을 추가했다.
## 다음 task가 알아야 할 것
- `node src/cli.js examples/Q-0457.json` → total 56278, validUntil 2026-10-19
- 옛 코드 확인: `git archive ba89ca0~1 | tar -x -C <dir>` 후 CLI → vat 3589, total 56280
- 테스트: test/quote.test.js 마지막 항목. `npm test` 54건 통과
- 견적 합계 계산 경로는 src/invoice/quote.js `quoteTotals` 하나뿐
