---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 키에서 runId를 뺀다"
    why: "재실행·겹친 실행·일정 재시작이 같은 요약을 가리켜야 한 번만 나간다. 실행별 집계는 ledger entry의 runId로 유지"
    by: ai
  - what: "withDeadline이 성공을 실패로 바꾸지 않게 한다"
    why: "팀 지식 docs/knowledge/retry/success-is-success-regardless-of-time.md. 재시도·횟수는 건드리지 않음"
    by: ai
  - what: "일정이 놓친 지난 기간도 보낸다"
    why: "완료조건: 요약이 하루 건너뛰어지지 않는다"
    by: ai
assumptions:
  - "ledger는 서버 간 공유 DB라고 가정(주석 기준). 여기서는 메모리"
rejected:
  - "재시도 정책 과다: 실제 실패는 한 번 재시도로 1통만 나감, 비목표"
open_questions: []
intent_deviation: null
risks:
  - "어댑터가 ETIMEDOUT/ECONNRESET을 던졌는데 서버는 이미 보낸 경우는 알 수 없어 재시도되며 중복 가능(멱등 키 필요)"
  - "프로세스 재시작 시 메모리 ledger가 비어 중복 가능. 운영 DB 사용 시 해소"
  - "재시도를 소진해 failed된 기간은 일정이 다시 시도하지 않음(수동 run으로 재발송됨). 영구 오류 무한 반복을 피하려는 선택"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: deadline/시간 초과 처리. 머지 시 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "요약 발송 기록 키는 (기간, 사용자)이며 runId를 넣지 않는다. runId는 ledger entry에만 둔다 (src/digest/key.js)"
  - "요약 일정은 실행이 성공해야 lastPeriod를 올리고, 놓친 지난 기간도 보낸다 (src/digest/scheduler.js)"
---
## 요약
요약 중복은 네 경로에서 났다: 느린 성공의 시간 초과 재시도, runId가 든 키로 재실행 중복, 겹친 실행, 일정 재호출. 누락은 오류 시 기간이 올라가고 놓친 날을 안 보내서였다. 모두 고치고 경로별 테스트를 추가했다. `npm test` 82/82 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/{deadline,key,runner,scheduler}.js`, 테스트 `test/digest.test.js` 10~17번.
- 수정 전 6개 실패, 수정 후 통과 확인함.
- 재시도 정책·횟수는 그대로.
- 남은 위험은 risks 참고(멱등 키 없음, 메모리 ledger).
