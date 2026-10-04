---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "업무 유형은 bugfix 그대로 두고 질문 없이 초안을 썼다"
    why: "요청이 현재 동작이 틀렸다고 말하므로 유형과 맞다"
    by: ai
assumptions:
  - "중복 알림은 재시도 경로와 관련 있을 수 있으나 확인하지 않았다(원인은 fix에서 조사)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "재현 절차가 요청에 없어 fix에서 직접 재현을 만들어야 한다"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄는 것은 해결이 아니다. 실제로 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
중복 알림(2~3회, 메일이 더 잦음) 버그의 intent 초안을 썼다. 재시도를 끄지 않는 것이 비목표/제약이다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/` 아래.
- 코드는 보지 않았다. 관련 후보 디렉터리(참고용): `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/adapters/mail.js`, `src/digest/`.
