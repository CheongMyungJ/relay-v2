---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "재현 절차는 fix 단계에서 테스트로 만든다 (요청에 재현 절차가 없음)"
  - "중복 기준은 같은 알림, 같은 고객, 같은 채널로 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "메일이 더 잦다는 점의 원인은 아직 모름. 채널별 차이를 fix에서 확인해야 함"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄면 안 되고, 실제로 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
중복 알림 버그의 의도 초안을 썼다. 재시도는 유지하고 중복 발송만 막는 것이 목표다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`, 테스트는 `test/`)
- 관련 후보 코드(읽지 않고 이름만 확인): `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/digest/`, `src/adapters/mail.js`
