---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 중복 발송을 고치되 실패한 요약의 재발송과 하루 누락 방지를 완료조건에 넣는다"
    why: "요청 원문: 증상만 막는 수정은 싫고, 못 보낸 요약은 다시 보내야 하며, 하루 건너뛰면 안 된다"
    by: ai
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 본다"
  - "요약 발송 경로는 예약 실행, 재시도 등 여러 개일 수 있어 경로별 근거를 완료조건으로 요구한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식의 중복 발송 건(Work w-20261004-001)은 머지 대기라 이 브랜치에 고친 코드가 없다. 같은 원인이면 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그의 의도 초안을 썼다. 근본 원인 수정, 실패한 요약의 재발송 유지, 하루 누락 금지, 경로별 한 번만 발송 근거를 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (`node --test`), 테스트 파일은 `test/` (예: `test/digest.test.js`)
- 요약 코드: `src/digest/` (runner.js, scheduler.js, ledger.js, key.js, deadline.js), 재시도: `src/retry/`
- 참고 팀 지식(조사로 알아낸 것이라 원인 근거 아님): `docs/knowledge/delivery/slow-success-is-success.md` (기준 브랜치에는 아직 없음)
- 내 가설은 없다. 코드는 읽지 않았다.
