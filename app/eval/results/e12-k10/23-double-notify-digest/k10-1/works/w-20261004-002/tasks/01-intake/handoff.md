---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 가정했다"
  - "요약 중복의 경로는 src/digest/(scheduler, runner, ledger, key)와 src/retry/ 쪽에 있을 것으로 보고 완료조건을 경로별로 썼다. 실제 경로 목록은 fix에서 확정한다"
  - "비목표의 push 등 일반 알림 제외는 요청이 요약 메일에 한정된 점에서 추정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원인이 요약 전용 코드가 아니라 공유 코드(dedupe, retry, adapters)에 있으면 범위가 넓어질 수 있다"
recommended_next: null
knowledge_candidates:
  - "재시도는 끄지 않는다. 못 보낸 요약은 다시 보내야 하고, 요약을 하루 건너뛰면 문의가 더 온다 (사람)"
---
## 요약
아침 요약 메일 중복 발송(같은 날 2~3통) 버그의 의도 초안을 썼다. 재시도 유지를 제약으로, 경로별 한 번만 전달됨을 완료조건으로 두었다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (node --test), 테스트는 `test/` (예: `test/digest.test.js`)
- 코드는 보지 않았고 원인 가설은 없다. 관련 후보 디렉터리: `src/digest/`(inbox, key, ledger, runner, scheduler, deadline), `src/retry/`(queue, worker, policy), `src/dedupe/`, `src/dispatch/delivery-log.js`
- 요청: 고쳤다는 보고에 경로마다 한 번만 받는다는 근거를 포함할 것
- 팀 지식 항목 없음
