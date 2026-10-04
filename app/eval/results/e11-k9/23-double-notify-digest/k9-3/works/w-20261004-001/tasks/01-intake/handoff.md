---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "중복 발송은 모든 채널에서 막아야 한다고 보았다 (요청은 메일이 더 잦다고만 말함)"
  - "테스트 명령은 package.json의 `npm test` (node --test)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "재현 절차가 요청에 없어 fix에서 직접 만들어야 한다"
recommended_next: null
knowledge_candidates:
  - "재시도를 끄는 것은 중복 발송의 해결이 아니다. 실제로 실패한 발송은 반드시 다시 보낸다 (사람)"
---
## 요약
중복 알림 버그 수정 intent 초안을 썼다. 재시도는 유지하고, 성공한 발송은 한 번만, 실패한 발송은 재발송하는 것이 완료조건이다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (`node --test`), 코드는 `src/`, 테스트는 `test/`
- `docs/knowledge/`는 없다
- 원인은 조사하지 않았다. 가설 없음
