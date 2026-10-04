---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 '성공 후 재발송 없음'과 '실제 실패는 재발송' 테스트 두 항목을 넣는다"
    why: "요청의 '실제로 못 보낸 요약은 다시 보내야 한다'와 팀 규칙(real-failures-must-be-resent)"
    by: ai
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261004-001)에서 왔고 머지 대기 중이라 이 브랜치에는 docs/knowledge/가 없음. 같은 규칙을 어기는 코드가 보이면 앞 Work에서 고쳤을 수 있음"
recommended_next: null
knowledge_candidates:
  - "요약 메일 중복 발송을 해결할 때 재시도를 끄는 것은 해결이 아니다. 실제로 못 보낸 요약은 다시 보내야 한다 (사람)"
---
## 요약
아침 요약 메일 중복 발송 버그의 intent 초안을 썼다. 원인은 적지 않았고, 재시도를 끄지 않는다는 팀 규칙을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (`node --test`), 요약 관련 `test/digest.test.js`
- 요약 코드: `src/digest/` (runner, scheduler, ledger, key, deadline), 재시도: `src/retry/`, 중복 제거: `src/dedupe/`
- 참고 팀 지식(앞 Work 것, 기준 브랜치에 아직 없음): `docs/knowledge/delivery/success-beats-timeout.md`, `docs/knowledge/delivery/real-failures-must-be-resent.md`. 앞 Work의 조사 사실이라 이번 원인의 근거는 아니며, 지금 코드로 직접 확인할 것.
