---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도 비활성화·축소로 고치지 않는 것을 비목표와 제약에 넣는다"
    why: "팀 지식 규칙과 요청의 '못 보낸 요약은 다시 보내야 한다'가 일치"
    by: ai
assumptions:
  - "요청의 '두 통, 세 통'은 요약 발송 경로의 재발송 때문이라고 보지 않고, 원인은 fix에서 확인한다"
  - "테스트 명령은 package.json의 npm test(node --test)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 시간 초과 판정 관련 코드(src/retry/policy.js, src/digest/deadline.js)"
recommended_next: null
knowledge_candidates:
  - "중복 알림을 재시도를 끄거나 줄이는 방식으로 고치지 않는다. 실패한 건의 재시도는 유지한다. (사람)"
---
## 요약
요약 메일 중복 발송 버그의 intent 초안을 썼다. 재시도를 끄지 않고, 성공한 건은 한 번만, 실패한 건은 재시도, 건너뛰기 없음을 완료조건으로 했다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (node --test), 테스트는 `test/`.
- 요약 코드: `src/digest/`(runner, scheduler, ledger, deadline, key), 재시도: `src/retry/`.
- 참고할 팀 지식(기준 브랜치에는 아직 없음): docs/knowledge/successful-send-is-never-timeout.md. 원인 근거는 아니며 fix에서 직접 확인할 것.
