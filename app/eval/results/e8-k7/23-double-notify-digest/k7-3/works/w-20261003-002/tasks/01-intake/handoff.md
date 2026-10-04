---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "비목표에 증상만 막는 수정(건너뛰기, 재시도 전체 끄기)을 넣는다"
    why: "요청: 증상만 막는 수정은 싫다, 실패한 요약은 재발송, 하루 건너뛰기 금지"
    by: human
  - what: "팀 지식의 느린 성공 규칙을 제약에 옮긴다"
    why: "종류가 규칙이고 요약 메일에도 해당한다고 적혀 있음"
    by: ai
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261003-001)에서 온 것으로 머지 대기 중이라 그 수정이 이 브랜치에 없다. 같은 규칙을 어기는 코드가 보이면 앞 Work에서 이미 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송(하루 2~3통) 버그의 의도 초안을 썼다. 목표는 원인 수정, 실패 요약 재발송 유지, 하루 건너뛰기 금지, 경로별 한 번 수신 근거 제시다. 질문 없이 초안으로 끝냈다.
## 다음 task가 알아야 할 것
- 테스트: `npm test`(`node --test`), 테스트 파일은 `test/digest.test.js` 등.
- 요약 관련 코드: `src/digest/`(runner, scheduler, ledger, key, deadline, inbox), 재시도: `src/retry/`(policy, queue, worker).
- 참고 팀 지식: `docs/knowledge/slow-success-is-success.md`(기준 브랜치에 아직 없음). 이번 버그의 원인이라는 근거는 아니니 코드로 직접 확인할 것.
- 원인에 대한 가설은 세우지 않았다.
