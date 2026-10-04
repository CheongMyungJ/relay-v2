---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "재시도 비활성화는 비목표, 실패 건 재발송 유지는 완료조건으로 한다"
    why: "요청 원문의 제약"
    by: human
assumptions:
  - "중복은 메일과 푸시 양쪽 모두 해당하나 메일에서 더 잦다고 보고 두 채널 모두 범위로 잡았다"
  - "테스트 명령은 package.json의 `npm test`(node --test)로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "요청에 재현 절차가 없어 fix 단계에서 재현부터 해야 한다"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄는 것은 중복 발송의 해결이 아니다. 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
중복 알림 수신 버그의 의도 초안을 썼다. 재시도는 유지하고 실패 건은 재발송하는 것이 조건이다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (node --test), 테스트는 `test/`에 있다.
- 후보 위치(가설, 확인 안 됨): `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/adapters/mail.js`, `src/digest/`.
- 팀 지식 항목은 없다.
