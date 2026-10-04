---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도를 끄는 수정은 비목표와 제약에 넣는다"
    why: "요청 원문이 재시도 비활성화 방식을 금지하고 실패한 발송은 다시 보내라고 명시함"
    by: human
assumptions:
  - "중복은 한 알림이 같은 고객에게 같은 채널로 여러 번 가는 것으로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "재현 절차가 요청에 없어 fix 단계에서 직접 재현해야 함"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄는 것은 해결이 아니다. 실패한 발송은 반드시 다시 보내야 한다 (사람)"
---
## 요약
중복 알림 발송 버그를 고치는 intent 초안을 썼다. 재시도를 끄지 않고 중복만 없애는 것이 핵심이다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`, `test/` 폴더)
- 관련 후보 코드(참고, 확인 안 됨): `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/adapters/mail.js`
- 팀 지식 항목 없음
