---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "중복 원인 두 가지(성공 후 시간 초과를 오류로 바꿈, 키에 runId 포함)를 모두 요약 경로 안에서 고친다"
    why: "둘 다 요약 중복 발송의 원인이고 각각 다른 경로에서 재현됨. 요청: 원인 자체를 고치고 경로마다 근거를 보여 줌"
    by: ai
  - what: "재시도 횟수와 지연은 그대로 두고, 성공 후 초과는 overrun으로만 기록한다"
    why: "docs/knowledge/dispatch/never-disable-retry-to-stop-duplicates.md: 재시도를 줄이지 않고 실패 시 재발송 테스트를 둔다"
    by: ai
  - what: "동시 실행 방지를 위해 ledger에 claim/release를 추가한다"
    why: "has 확인과 markSent 사이에 틈이 있어 동시 실행이 둘 다 보냄(테스트로 재현)"
    by: ai
assumptions:
  - "운영의 발송 기록 DB도 이 메모리 ledger와 같은 키·claim 의미를 쓴다고 가정(여기서는 메모리 구현만 확인)"
rejected:
  - "재시도 횟수·지연 조정: 실제 실패는 재시도로 복구되고 팀 규칙이 금지함"
  - "요약함의 이벤트 중복 담기: 기존 테스트가 막고 있고 증상은 메일 통수"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/retry/policy.js의 decide, src/digest/deadline.js의 withDeadline. 머지 시 deadline.js에서 충돌할 수 있음"
  - "runId가 키에서 빠져 ledger.has/claim은 기간+사용자 단위다. 의도적으로 같은 기간을 다시 보내려면 보낸 키 TTL(ledgerTtlMs)이 지나야 한다"
  - "claim은 프로세스 메모리 기준이다. 여러 서버가 각자 메모리 ledger를 쓰면 서버 간 동시 실행은 막지 못한다(운영 DB ledger가 원자적 claim을 지원해야 함)"
  - "어댑터가 실제로 시간 초과 오류를 던졌지만 서버가 접수한 경우의 중복은 이번에 다루지 않음"
recommended_next: null
knowledge_candidates:
  - "요약 중복 방지 키는 기간+사용자이며 runId를 넣지 않는다. 실행별 집계는 기록의 runId로 한다. 위치: src/digest/key.js, ledger.js"
  - "요약 러너는 ledger.claim으로 보낼 권리를 얻고 실패하면 release한다. 동시 실행이 같은 요약을 둘 다 보내는 것을 막는다. 위치: src/digest/runner.js"
  - "src/digest/deadline.js의 withDeadline은 성공 후 초과를 오류가 아니라 overrun으로 알린다(요약 경로에서 확인)"
---
## 요약
요약 메일 중복의 원인 두 가지를 고쳤다. (1) 성공한 발송이 3초를 넘기면 timeout 오류로 바뀌어 재시도로 최대 3통이 나갔다. (2) 중복 방지 키에 runId가 들어 있어 재실행, 스케줄러 재시작, 동시 실행에서 또 나갔다. 재시도는 그대로 두고 실패 시 재발송 테스트를 유지·추가했다. `npm test` 83건 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`(overrun), `key.js`(runId 제거), `ledger.js`(claim/release), `runner.js`.
- 테스트: `test/digest.test.js` 끝의 새 9건. 수정 전 6건 실패, 수정 후 모두 통과. 기존 테스트는 바꾸지 않았다.
- 경로별 근거 목록은 `fix.md`의 변경 요약에 있다.
- 서버 간 동시 실행은 운영 DB ledger의 원자적 claim이 필요하다.
