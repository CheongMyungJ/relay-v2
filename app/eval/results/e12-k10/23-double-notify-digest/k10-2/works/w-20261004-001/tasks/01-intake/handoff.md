---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도는 유지하고 실제 실패한 발송만 다시 보내는 것을 제약과 완료조건으로 둔다"
    why: "요청 원문: 재시도 자체를 끄면 안 되고 실제로 실패한 발송은 다시 보내야 한다"
    by: human
assumptions:
  - "재현 절차는 fix 단계에서 테스트로 만든다 (요청에 재현 절차가 없음)"
  - "중복은 메일과 푸시 모두에서 일어날 수 있고, 메일에서 더 잦다고 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원인을 아직 모르므로 완료조건의 테스트 항목이 실제 원인에 맞게 조정될 수 있다"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄면 안 되고, 실제로 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
중복 알림 발송 버그의 의도 초안을 썼다. 코드는 건드리지 않았고 원인은 조사하지 않았다. 테스트 명령은 `npm test`(`node --test`)다.
## 다음 task가 알아야 할 것
- 중복 방지와 재시도 관련 코드 위치: `src/dedupe/`(deduper.js, key.js, store.js), `src/retry/`(queue.js, worker.js, policy.js, backoff.js), `src/dispatch/`(dispatcher.js, delivery-log.js), `src/adapters/mail.js`
- 관련 테스트: `test/dedupe.test.js`, `test/delivery-log.test.js`
- 이 위치들은 이름만 보고 적은 참고용이며 원인이라는 근거는 아니다.
