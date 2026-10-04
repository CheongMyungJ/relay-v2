---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "중복 방지 대상은 메일과 푸시 모두이며, 메일이 더 자주 나타난다는 것은 증상일 뿐 범위 제한이 아니라고 가정함"
  - "테스트 명령은 package.json의 `npm test`(node --test)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원인을 아직 모른다. 재시도, 중복 제거(dedupe), 다이제스트 중 어디인지는 fix에서 확인해야 함"
recommended_next: null
knowledge_candidates: []
---
## 요약
같은 알림이 두 번 이상 전달되는 버그의 의도 초안을 썼다. 재시도는 유지하고 실제 실패만 다시 보내는 조건을 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (`node --test`, `test/` 디렉터리)
- 관련 후보 코드(참고용, 원인 확인 안 됨): `src/retry/`(queue, worker, policy), `src/dedupe/`, `src/dispatch/`, `src/adapters/mail.js`, `src/digest/`
- 팀 지식 항목 없음
