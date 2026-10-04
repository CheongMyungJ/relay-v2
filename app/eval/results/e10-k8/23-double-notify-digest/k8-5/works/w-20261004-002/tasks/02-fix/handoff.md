---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "느린 성공은 성공으로 두고 digest.slow 지표로만 남긴다"
    why: "팀 지식 docs/knowledge/retry/success-is-never-timeout.md. 코드에서 같은 원인을 확인함"
    by: ai
  - what: "재시도 횟수·정책은 건드리지 않았다"
    why: "팀 지식 docs/knowledge/retry/keep-retry-for-real-failures.md"
    by: ai
  - what: "발송 키에서 runId를 빼고 claim/release로 동시 실행도 막는다"
    why: "같은 날짜 요약은 실행과 관계없이 한 번만 가야 한다는 요청"
    by: ai
assumptions:
  - "운영의 발송 기록은 서버들이 공유하는 DB라서, 메모리 ledger와 같은 키 규칙이면 재기동·다중 서버에서도 막힌다고 가정. claim은 메모리 구현이며 DB에서는 원자적 선점이 필요"
rejected:
  - "스케줄러가 같은 기간을 두 번 돈다: 한 프로세스는 lastPeriod로 막히고, 재기동은 키 수정으로 막힘"
  - "재시도 줄이기/끄기: 팀 규칙과 요청에 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "ledger.claim은 프로세스 안에서만 원자적이다. 실제 공유 DB 구현이 있다면 같은 선점이 필요함"
  - "키에서 runId를 빼서, 키 TTL(3일) 안에는 같은 날짜 요약을 일부러 다시 보낼 수 없다"
  - "앞 Work(w-20261004-001)에서 같은 deadline/policy 문제를 고쳤을 수 있음, 머지 대기. src/retry/policy.js는 요약 밖이라 건드리지 않음"
recommended_next: null
knowledge_candidates:
  - "요약 발송 키(digestKey)에 runId를 넣으면 재기동·재실행·동시 실행마다 중복 발송된다. 키는 period+userId만 쓴다"
  - "요약 중복의 원인 위치: src/digest/deadline.js(느린 성공을 시간 초과로 바꿈), src/digest/key.js(runId가 키에 포함)"
---
## 요약
요약 중복 발송의 원인 두 가지를 고쳤다. 느린 성공을 시간 초과로 바꿔 재시도하던 것을 성공으로 두고 slow 지표만 남기게 했다. 발송 키에서 runId를 빼고 보내기 전 키를 차지해 재실행·동시 실행도 한 통만 나가게 했다. 재시도는 그대로이며 `npm test` 79건 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `key.js`, `ledger.js`(claim/release), `runner.js`.
- 새 테스트: `test/digest.test.js` 마지막 5건. 수정 전 3건 실패, 수정 후 모두 통과.
- 경로별 근거 표는 `fix.md` 마지막에 있다.
- 기존 테스트는 바꾸지 않았다.
