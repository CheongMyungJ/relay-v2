---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 요약 발송은 제한 시간을 넘겨도 성공으로 처리하고 slow 표시와 경고 로그만 남긴다"
    why: "팀 지식 docs/knowledge/successful-send-is-never-timeout.md 규칙"
    by: ai
  - what: "요약 보낸 키에서 runId를 빼서 같은 기간·사용자는 실행이 달라도 한 번만 보낸다"
    why: "완료조건: 같은 날짜 요약은 성공하면 한 번만 전달. 실행별 건수는 ledger의 runId로 센다"
    by: ai
  - what: "재시도 정책은 건드리지 않고 시간 초과 오류로 실패한 건의 재시도를 테스트로 보존한다"
    why: "팀 지식 docs/knowledge/never-disable-retry-to-fix-duplicates.md 와 비목표"
    by: ai
assumptions:
  - "같은 기간 재실행(재시작·수동·다중 서버)이 운영에서 일어난다고 가정, 운영 로그로는 확인하지 못함"
rejected:
  - "재시도 횟수·정책 축소: 비목표이며 실패 건 재시도는 유지해야 함"
open_questions: []
intent_deviation: null
risks:
  - "진짜 시간 초과 오류(어댑터가 던진 오류) 뒤 재시도는 멱등 키가 없어 중복될 수 있음"
  - "src/retry/policy.js decide()는 같은 시간 초과 판정 문제가 있으나 요약 경로가 아니고 범위 밖이라 안 고침. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "ledger 보낸 키 TTL(ledgerTtlMs)이 지나면 같은 기간을 재실행할 때 다시 보낼 수 있음"
recommended_next: null
knowledge_candidates:
  - "요약 발송 키에는 runId를 넣지 않는다. 같은 기간·사용자는 실행이 달라도 한 번만 보낸다(src/digest/key.js). 실행별 건수는 ledger의 runId로 센다."
  - "요약 발송 withDeadline은 성공한 호출을 시간 초과로 던지지 않는다(slow 표시만). 느린 메일 성공이 재시도로 2~3통 중복되던 원인이었다(src/digest/deadline.js)."
---
## 요약
요약 메일 중복의 원인 두 가지를 고쳤다. 느리게 성공한 발송을 시간 초과로 보고 재시도하던 것과, 보낸 키에 runId가 있어 재실행 때 또 보내던 것이다. 재시도 정책은 그대로이고 실패 건 재시도는 테스트로 보존했다.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/runner.js`, `src/digest/key.js`. 테스트는 `test/digest.test.js` 끝의 4건.
- `npm test` 78건 통과(수정 전 3건이 새 테스트에서 실패).
- 재현: 메일 지연 3500ms(`digestSetup({ mail: { latencyMs: 3500 } })`), 제한 3000ms.
