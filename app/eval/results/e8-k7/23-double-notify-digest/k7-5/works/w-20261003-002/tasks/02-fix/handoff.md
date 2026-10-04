---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 키에서 runId를 뺐다"
    why: "docs/knowledge/digest-key-excludes-run-id.md: 실행별 집계는 ledger entry의 runId 필드로 한다"
    by: ai
  - what: "느린 성공은 오류로 바꾸지 않고 slow로만 알린다"
    why: "docs/knowledge/successful-send-never-retried-on-slow.md와 intent 제약"
    by: ai
  - what: "스케줄러가 성공 후에만 기간을 done으로 치고, inbox에 남은 놓친 기간도 보낸다"
    why: "완료조건: 요약이 하루 건너뛰어지지 않는다"
    by: ai
assumptions:
  - "서버가 꺼져 있던 날의 요약도 inbox에 알림이 남아 있으면(keepDays 2일 안) 보내야 한다고 봤다"
rejected:
  - "retry/policy.js decide()의 같은 패턴: 일반 알림 전용이라 비목표, 요약은 쓰지 않음"
open_questions: []
intent_deviation: null
risks:
  - "키 형식 변경 직후 옛 키(runId 포함)는 인식되지 않아 배포 직후 그 기간은 한 번 더 갈 수 있음"
  - "decide()(src/retry/policy.js)는 일반 알림에서 느린 성공을 timeout으로 재시도하는 같은 문제가 남아 있음(비목표라 미수정, 앞 Work w-20261003-001에서 고쳤을 수 있음, 머지 대기)"
  - "run이 끝까지 가서 failed로 포기한 사용자는 같은 프로세스의 다음 tick에서 자동 재시도되지 않고 수동 run으로만 재발송됨"
recommended_next: null
knowledge_candidates:
  - "요약 스케줄러는 실행이 끝난 뒤에만 기간을 보낸 것으로 기록하고, inbox에 남은 이전 기간도 따라잡는다(src/digest/scheduler.js)"
---
## 요약
요약 중복의 원인 셋(runId 포함 키, 느린 성공을 오류로 바꿔 재시도, 실행 전 lastPeriod 기록·어제만 보는 일정)을 고치고 테스트 6개를 추가했다. `npm test` 80개 통과.
## 다음 task가 알아야 할 것
- 키: `src/digest/key.js`, 느린 성공: `deadline.js`의 `slow`, 러너 `summary.slow`
- 일정: `src/digest/scheduler.js`의 `done` 집합과 catch-up 반복
- 테스트: `test/digest.test.js` 끝 6개, 명령 `npm test`
