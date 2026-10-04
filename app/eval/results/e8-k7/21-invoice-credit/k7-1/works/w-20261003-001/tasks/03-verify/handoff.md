---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(권장, 할인 후 공급가액 테스트)만 반영하고 2(사소)는 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행 후 저장된 totals와 반품 전표(src/invoice/credit-note.js:90)는 이전 방식이라 새 계산과 다를 수 있다(비목표)"
  - "음수 공급가액 줄의 floor 동작은 확인하지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건(할인 후 공급가액 테스트)을 반영해 커밋했다. 모든 완료조건이 통과이고 `npm test` 49건이 통과한다. 테스트 파일 변경은 추가뿐이라 약화가 아니다.
남긴 지식: docs/knowledge/vat-floor-per-line.md, docs/knowledge/vat-code-locations.md
## 다음 task가 알아야 할 것
- 변경: `src/invoice/total.js:26-28`, 테스트 `test/total.test.js` 끝 3건
- 커밋: 7453afc(테스트), 그 뒤 docs 커밋
- 테스트 명령: `npm test` (49 통과)
- 반품 전표 부가세는 `src/invoice/credit-note.js:90`에서 여전히 합계 반올림
