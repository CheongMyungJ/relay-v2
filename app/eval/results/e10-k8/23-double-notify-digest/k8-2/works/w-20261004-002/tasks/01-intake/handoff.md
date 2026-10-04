---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도는 유지하고 중복만 없애는 것을 제약으로 둔다"
    why: "요청(실제로 못 보낸 요약은 다시 보내야 함)과 팀 지식 retry-keeps-real-failures.md"
    by: human
assumptions:
  - "재현 절차는 fix 단계에서 중복 발송 테스트로 만든다(요청에 절차가 없음)"
  - "중복 기준은 같은 날 같은 수신자의 요약 메일로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 파일은 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에 아직 없다. 그 Work가 고친 코드(decide, withTiming 등)가 이 브랜치에 없을 수 있다. 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그의 의도 초안을 썼다. 목표는 중복 제거, 제약은 재시도 유지(실제 실패는 반드시 재전송)다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트 위치 `test/digest.test.js`, `test/retry.test.js`
- 관련 코드 후보: `src/digest/`(runner, scheduler, ledger, key, deadline), `src/retry/`(policy, queue, worker)
- 참고 팀 지식(기준 브랜치에 아직 없음): `docs/knowledge/notify/slow-success-is-success.md` (느린 성공을 시간 초과 실패로 보면 중복 발송됨, 조사 결과이며 이번 원인이라는 근거는 아님)
