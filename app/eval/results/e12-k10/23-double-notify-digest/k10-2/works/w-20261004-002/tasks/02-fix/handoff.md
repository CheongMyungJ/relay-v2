---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 키에서 runId를 빼고 기간+사용자로만 만든다"
    why: "실행이 다르면 같은 고객에게 다시 보내지는 원인 B 제거. 실행별 집계는 원장의 runId 필드로 유지"
    by: ai
  - what: "withDeadline은 성공이면 던지지 않고 slow만 표시, 실패한 발송만 재시도"
    why: "팀 지식 docs/knowledge/dispatch/retry-only-failed-sends.md 규칙"
    by: ai
assumptions:
  - "운영에서는 발송 기록이 서버들이 공유하는 DB라서 키만 같으면 서버 간 재실행도 막힌다고 가정(여기서는 메모리 원장)"
rejected:
  - "스케줄러 lastPeriod 중복 실행: 한 프로세스 안에서는 이미 막혀 있음"
  - "인박스 중복 담기: inbox.add가 이미 막음"
open_questions: []
intent_deviation: null
risks:
  - "같은 원인이 일반 알림 경로에 있음: src/retry/policy.js decide()가 elapsedMs > timeoutMs를 outcome.ok보다 먼저 봐서 느린 성공도 retry. 비목표라 고치지 않음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "원장 TTL(ledgerTtlMs 3일) 지난 뒤, 또는 원장이 비는 재시작에서는 재실행 시 다시 발송될 수 있음"
  - "동시에 두 실행이 돌면 has 검사와 markSent 사이에 경쟁 가능(발송 전 예약 없음)"
recommended_next: null
knowledge_candidates:
  - "요약 중복 발송 원인: digestKey에 runId가 있으면 실행이 다를 때 중복 방지가 안 된다. 키는 기간+사용자 (src/digest/key.js)"
  - "요약 withDeadline은 성공이면 던지지 않고 slow만 표시한다 (src/digest/deadline.js). 일반 경로 retry/policy.js decide()도 같은 규칙"
---
## 요약
요약 중복의 원인 두 가지를 고쳤다. (A) 제한 시간을 넘긴 성공 발송을 실패로 보고 재시도함. (B) 요약 키에 runId가 있어 재실행 시 중복 방지가 안 됨. 실패한 발송의 재시도는 유지했고 테스트 5건을 추가했다. `npm test` 79건 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js`. 테스트: `test/digest.test.js` 끝 5건.
- 경로별 근거 표는 `fix.md`에 있음.
- 일반 알림 경로 `src/retry/policy.js` decide()에 같은 원인이 남아 있을 수 있음(이번 범위 밖).
- 기존 테스트 변경 없음. 수정 전 실패 4건, 수정 후 전부 통과.
