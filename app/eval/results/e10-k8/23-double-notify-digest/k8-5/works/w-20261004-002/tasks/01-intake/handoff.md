---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "재시도는 유지하고 중복 방지는 성공 발송을 다시 보내지 않는 쪽으로 푼다"
    why: "팀 지식 keep-retry-for-real-failures 규칙과 요청의 '실제로 못 보낸 요약은 다시 보내야 한다'"
    by: human
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 가정"
  - "'경로'는 요약 발송이 일어나는 각 코드 경로(스케줄러, 러너, 재시도 등)로 해석"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261004-001)에서 왔고 머지 대기 중이라 이 브랜치에 그 수정이 없다. 같은 규칙을 어기는 코드가 보이면 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "요약을 하루 건너뛰면 문의가 더 오므로, 실제로 못 보낸 요약은 반드시 다시 보낸다 (사람)"
---
## 요약
요약 메일 중복 발송(같은 날 2~3통) 버그의 intent 초안을 썼다. 원인은 조사하지 않았다. 재시도 유지 제약과 경로별 한 번 수신 근거를 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 테스트: `npm test`. 요약 관련 코드는 `src/digest/` (deadline.js, ledger.js, key.js, runner.js, scheduler.js), 재시도는 `src/retry/`.
- 참고할 팀 지식(조사 사실, 원인 근거 아님): `docs/knowledge/retry/success-is-never-timeout.md`
- 규칙: `docs/knowledge/retry/keep-retry-for-real-failures.md`
