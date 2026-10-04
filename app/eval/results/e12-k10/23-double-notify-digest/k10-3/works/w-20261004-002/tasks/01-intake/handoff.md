---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 경로별 한 번만 발송 근거와 실패 시 재발송 테스트를 넣는다"
    why: "요청: 경로마다 근거를 보여 주고, 실제로 못 보낸 요약은 다시 보내야 한다"
    by: ai
assumptions:
  - "테스트 명령은 package.json의 npm test (node --test)로 가정"
  - "요약 발송 경로는 src/digest/ 아래(runner, scheduler, ledger, deadline 등)와 retry 쪽이라고 가정. 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/retry/policy.js의 decide, src/digest/deadline.js의 withDeadline (성공 후 시간 초과를 timeout으로 바꿔 재시도하며 중복 발송). 이 브랜치에는 아직 없다."
recommended_next: null
knowledge_candidates: []
---
## 요약
아침 요약 메일이 같은 날 2~3통 가는 버그의 intent 초안을 썼다. 원인은 쓰지 않았다. 재시도를 줄이지 않고 실패 시 재발송을 유지하는 조건과 경로별 근거를 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (`node --test`), 요약 테스트는 `test/digest.test.js`.
- 참고할 팀 지식: `docs/knowledge/dispatch/success-before-timeout.md` (참고용 사실이며 이번 버그의 원인이라는 근거는 아님), `docs/knowledge/dispatch/never-disable-retry-to-stop-duplicates.md` (규칙, intent 제약에 옮김).
- 요약 관련 파일: `src/digest/` (runner, scheduler, ledger, key, deadline), `src/retry/`.
