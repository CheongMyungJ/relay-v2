---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "늦은 성공을 성공으로 보고 withDeadline이 더는 던지지 않게 했다. timeoutMs 인자는 남겨 두고 쓰지 않는다"
    why: "docs/knowledge/delivery/late-success-is-success.md 규칙. 재시도 정책은 약화하지 않음"
    by: ai
  - what: "요약 키에서 runId를 뺐다"
    why: "같은 기간 재실행 시 중복 방지. 실행별 집계는 ledger 기록의 runId로 유지"
    by: ai
assumptions:
  - "운영에서 ledger는 서버들이 공유하는 DB라고 가정(코드 주석 기준). 메모리 ledger는 프로세스 재시작 시 비워지므로 그 경우의 중복은 이 수정으로 막지 못함"
rejected:
  - "스케줄러 lastPeriod 메모리 값이 원인: 키에서 runId를 빼면 ledger가 막아 주므로 단독 원인이 아님"
open_questions: []
intent_deviation: null
risks:
  - "일반 발송 src/retry/policy.js의 decide도 같은 늦은 성공 문제(elapsedMs > timeoutMs 우선)가 남아 있음. 요약 범위 밖이라 건드리지 않음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "digest.sendTimeoutMs는 여전히 효과 없음(지표만 남음). 설정을 다시 쓰려면 실제 중단 방식 필요"
  - "기존 테스트는 변경하지 않음"
recommended_next: null
knowledge_candidates:
  - "요약 중복 방지 키는 기간+사용자만 쓴다(runId 없음). 실행별 집계는 ledger 기록의 runId로 본다. src/digest/key.js"
  - "고칠 지식: docs/knowledge/delivery/digest-sendtimeout-unused.md — 요약 키의 runId 중복 문제는 이 Work에서 수정됨"
---
## 요약
요약 메일 중복의 원인 두 가지(늦은 성공을 시간 초과로 재시도, 키에 runId 포함)를 고치고 경로별 테스트 4개를 추가했다. `npm test` 78 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js:39`
- 테스트: `test/digest.test.js` 끝 4개(최초/재시도/재실행/실패 후 재발송). 수정 전 4개 실패 확인.
- `src/retry/policy.js` decide는 미수정(범위 밖).
