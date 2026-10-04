---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 가정"
  - "요청의 '경로마다'는 요약 발송이 거치는 모든 경로(정상 발송, 재시도, 스케줄러 재실행 등)로 해석"
  - "팀 지식의 규칙은 일반 발송뿐 아니라 요약 발송에도 그대로 적용된다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 retry/policy.js, digest/deadline.js를 이미 고쳤을 수 있음, 머지 대기. 이 브랜치에는 그 수정이 없을 수 있음"
recommended_next: null
knowledge_candidates:
  - "요약 메일을 하루 건너뛰면 문의가 더 많이 오므로, 실제로 못 보낸 요약은 반드시 다시 보내야 한다 (사람)"
---
## 요약
요약 메일 중복 발송(같은 날 2~3통) 버그 수정의 intent 초안을 썼다. 목표는 고객이 하루 한 번만 받게 하되, 실패한 발송의 재시도는 유지하는 것이다. 경로별 단일 수신 근거를 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 팀 지식 `docs/knowledge/dispatch/retry-only-failed-sends.md`(w-20261004-001, 기준 브랜치에 아직 없음)를 참고. 규칙은 intent `제약`에 옮겼다.
- 코드 확인 후보 위치(가설 아님, 참고): `src/digest/runner.js`, `src/digest/scheduler.js`, `src/digest/ledger.js`, `src/digest/key.js`, `src/digest/deadline.js`, `src/retry/policy.js`, `src/retry/worker.js`.
- 테스트: `npm test`, 요약 관련은 `test/digest.test.js`.
