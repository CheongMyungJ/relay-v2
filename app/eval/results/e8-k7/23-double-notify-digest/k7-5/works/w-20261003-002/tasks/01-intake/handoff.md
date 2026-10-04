---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 중복 방지, 실패 건 재발송, 하루 누락 방지 테스트 항목을 추가한다"
    why: "요청의 요구: 못 보낸 요약은 다시 보내고, 하루 건너뛰면 안 된다"
    by: ai
  - what: "느린 성공은 재시도하지 않는다는 팀 규칙을 제약에 옮겼다"
    why: "요약 발송에도 적용되는 규칙(팀 지식)"
    by: ai
assumptions:
  - "요청에 사람의 원인 추정이 없어 추가 의견은 비웠다"
  - "요약을 중복해서 받은 정확한 재현 절차는 요청에 없어 fix에서 찾는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목 두 개는 앞 Work(w-20261003-001)에서 왔고 기준 브랜치에는 없다. 같은 규칙을 어기는 코드가 보이면 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그 수정의 intent 초안을 썼다. 목표, 비목표, 원하는 결과, 완료조건(기본 3개 + 중복 방지, 재발송, 누락 방지)을 담았고 테스트 명령은 `npm test`다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/digest/` (key.js, runner.js, ledger.js, deadline.js, scheduler.js), `src/retry/policy.js`
- 참고할 팀 지식(실패 유형, 원인 근거 아님): `docs/knowledge/digest-key-excludes-run-id.md` (요약 키 형식과 runId)
- 반영한 팀 지식(규칙): `docs/knowledge/successful-send-never-retried-on-slow.md`
- 코드는 읽거나 바꾸지 않았다.
