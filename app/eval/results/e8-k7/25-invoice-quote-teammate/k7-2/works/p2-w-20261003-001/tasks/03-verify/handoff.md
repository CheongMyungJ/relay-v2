---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2(사소, 테스트 정리)를 모두 반영"
    why: "사람이 모두 반영을 골랐다"
    by: human
  - what: "재현 절차 완료조건은 판정 불가로 두고 완료 화면으로 진행"
    why: "기준 커밋에서 버그가 재현된 적이 없어 사람이 완료 화면 진행을 골랐다"
    by: human
assumptions:
  - "영업팀이 본 56,280원은 4307e8a 이전 빌드의 값이다. 실제 배포본은 확인하지 못했다"
rejected: []
open_questions: []
intent_deviation:
  summary: "기준 커밋에서 Q-0457 합계가 이미 56,278원이라 의도의 버그가 현재 코드에 없다"
  evidence: "node src/cli.js examples/Q-0457.json은 total 56278. 4307e8a^에서만 56280"
risks:
  - "영업팀 화면이 4307e8a 이전 배포본이면 재배포가 필요하다"
  - "이미 저장된 견적의 totals는 다시 계산하지 않았다"
  - "Q-0457 테스트는 수정 전에도 통과하는 회귀 방지용이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경 전체를 리뷰했고 사소한 테스트 지적 2건을 반영해 커밋(b8a89da)했다. `npm test` 55 pass. 재현 절차 완료조건은 판정 불가(버그가 재현된 적 없음), 나머지는 통과. 남긴 지식: docs/knowledge/quote-number-and-validity-are-read-by-sales.md, docs/knowledge/merge-dropped-import-credit-note.md
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js:92`: 반품 전표 부가세는 `sumWon(rows.map(lineVat))`
- `test/quote.test.js` 끝: Q-0457 테스트와 BK-1680 `lineVat` 0 단언
- 검증 명령: `npm test`, `node src/cli.js examples/Q-0457.json`
- 변경한 테스트 파일은 quote.test.js뿐이고 약화 아님
