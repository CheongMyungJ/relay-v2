---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "중복 발송은 메일과 푸시 두 채널 모두에서 고쳐야 하는 문제로 본다 (메일이 더 잦다고 했을 뿐 푸시도 있을 수 있음)"
  - "재현 절차는 fix 단계에서 테스트로 만든다 (요청에 재현 절차가 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "요청에 재현 조건이 없어 원인 범위가 넓다 (dedupe, retry, dispatch, digest 모두 후보)"
recommended_next: null
knowledge_candidates:
  - "재시도를 끄는 것은 해결이 아니다. 실제로 실패한 발송은 반드시 다시 보내야 한다 (사람)"
---
## 요약
중복 알림(2~3회, 메일이 더 잦음) 버그의 의도 초안을 썼다. 코드는 건드리지 않았다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/`에 있다.
- 코드 구조 후보 위치(원인 확인 아님): `src/dedupe/`, `src/retry/`(queue, worker, policy), `src/dispatch/`(dispatcher, delivery-log), `src/adapters/mail.js`, `src/digest/`.
