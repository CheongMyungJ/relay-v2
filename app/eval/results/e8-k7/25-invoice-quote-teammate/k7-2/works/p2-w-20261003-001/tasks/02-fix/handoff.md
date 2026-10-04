---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적 코드는 바꾸지 않고, npm test를 깨던 반품 전표 부가세를 공용 lineVat으로 고친다"
    why: "docs/knowledge/vat-floor-per-line.md: 청구서, 반품 전표, 견적이 같은 규칙을 쓰며 규칙을 볼 때 세 곳을 함께 본다. 완료조건에 npm test 통과가 있다"
    by: ai
assumptions:
  - "영업팀이 본 56,280원은 4307e8a 이전 빌드의 값이라고 추정했다. 영업팀이 실제로 어느 배포본을 봤는지는 확인하지 못했다"
rejected:
  - "현재 코드의 다른 경로가 56,280원을 낸다: quoteTotals, createQuote, CLI, index 내보내기를 모두 실행해 56,278원"
open_questions: []
intent_deviation:
  summary: "기준 커밋에서 Q-0457 견적 합계가 이미 56,278원이라 의도의 버그는 현재 코드에 없다. 4307e8a^에서만 56,280원이 나온다"
  evidence: "4307e8a^에서 node src/cli.js examples/Q-0457.json은 vat 3589, total 56280. 기준 커밋은 vat 3587, total 56278"
risks:
  - "Q-0457 테스트는 수정 전에도 통과하므로 회귀 방지용이다"
  - "영업팀이 보는 화면이 4307e8a 이전 배포본이면 코드 수정 없이 재배포가 필요하다. 이미 저장해 둔 견적의 totals는 이 Work에서 다시 계산하지 않았다"
recommended_next: null
knowledge_candidates:
  - "머지 뒤 credit-note.js에서 import 누락(VAT_RATE_PERCENT)이 생긴 적이 있다. 부가세 규칙을 바꿀 때는 청구서, 반품 전표, 견적이 모두 lineVat을 쓰는지 npm test로 확인한다"
---
## 요약
Q-0457 견적 합계는 기준 커밋에서 이미 56,278원이다. 56,280원은 4307e8a 이전 코드에서만 재현된다(합계 단위 부가세 3,589원). 대신 npm test를 깨던 반품 전표의 ReferenceError를 공용 lineVat 사용으로 고쳤고 Q-0457 회귀 테스트를 추가했다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js:92-94`: 반품 전표 부가세는 `lineVat`으로 합산
- `test/quote.test.js` 마지막 테스트: Q-0457 기대값 supply 52691, vat 3587, total 56278
- `npm test`: 55 pass. 기준 커밋에서는 반품 전표 5건 실패
- 견적 쪽 코드 변경 없음. 56,280원 재현: `4307e8a^` 체크아웃 후 `node src/cli.js examples/Q-0457.json`
