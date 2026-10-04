---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요청 유형은 bugfix 그대로 두고 질문 없이 초안을 썼다"
    why: "요청이 현재 동작이 틀렸다고 말하므로 유형과 맞다"
    by: ai
assumptions:
  - "요약 발송 경로는 여러 개(스케줄러, 재시도, 재실행 등)일 수 있어 경로별 근거를 완료조건에 넣었다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 느린 성공을 timeout 실패로 보고 재시도하는 문제(src/retry/policy.js, src/digest/deadline.js)"
  - "src/digest/key.js의 요약 키에 runId가 포함되어 재실행 간 중복 가능(팀 지식상 앞 Work에서 미해결). 이번 요청의 '같은 날 여러 통'과 관련될 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
아침 요약 메일 중복 발송 버그의 intent 초안을 썼다. 재시도를 끄지 않고, 실제 실패는 재발송하며, 경로별 한 번 발송 근거를 요구한다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 관련 코드: `src/digest/` (key.js, runner.js, scheduler.js, ledger.js, deadline.js), `src/retry/policy.js`
- 참고 팀 지식(조사 결과, 원인 확정 아님): `docs/knowledge/retry/digest-key-includes-run-id.md`, `docs/knowledge/retry/success-is-never-resent.md`
- 이 지식은 기준 브랜치에 아직 없고 앞 Work의 수정도 이 브랜치에 없다.
