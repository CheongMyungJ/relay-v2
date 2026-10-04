---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 중복 방지 테스트와 실패 시 재발송 테스트를 추가했다"
    why: "요청의 제약: 재시도는 유지하고 실제 실패는 다시 보내야 함"
    by: ai
assumptions:
  - "재현 절차는 fix 단계에서 테스트로 만든다(요청에 재현 절차가 없음)"
  - "테스트 명령은 package.json의 `npm test`(node --test)"
open_questions: []
rejected: []
intent_deviation: null
risks:
  - "요청에 어느 채널·경로인지 정보가 없어 원인 범위가 넓다"
recommended_next: null
knowledge_candidates:
  - "재시도를 끄면 안 되고, 실제로 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
중복 알림 버그의 의도를 bugfix로 정리했다. 재시도는 유지하고 중복만 없애는 것이 핵심이다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (node --test), 테스트는 `test/`
- 중복·재시도 관련 후보 코드(원인 확인 안 됨): `src/dedupe/`, `src/retry/`, `src/dispatch/`, `src/digest/`, `src/adapters/mail.js`
