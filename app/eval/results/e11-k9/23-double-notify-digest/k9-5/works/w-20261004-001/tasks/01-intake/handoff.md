---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "중복 방지 대상은 모든 채널이며, 메일은 가장 자주 나타나는 사례로 본다"
  - "정확한 재현 절차는 요청에 없어 fix에서 찾는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "요청이 재현 조건을 주지 않아 fix에서 재현부터 해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
중복 알림 발송 버그 수정 intent를 초안으로 썼다. 재시도는 유지하고 실제 실패만 재발송하는 것이 핵심 제약이다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/`에 있다.
- 코드는 읽지 않았다. 관련 후보 디렉터리(참고만, 원인 아님): `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/adapters/mail.js`, `src/digest/`.
- 팀 지식 항목은 없다.
