---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 요약 발송은 경과 시간과 무관하게 성공으로 보고, 요약 키에서 runId를 뺀다"
    why: "docs/knowledge/successful-send-is-never-timeout.md 규칙과 intent 원하는 결과(수신자당 하루 한 통, 실패는 재시도)"
    by: ai
assumptions:
  - "요약 키에서 runId를 빼도 운영 화면의 실행별 집계는 기록 항목의 runId로 충분하다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/retry/policy.js decide()도 성공인데 elapsedMs > timeoutMs면 timeout 재시도로 본다. 일반 알림(dispatcher.js:48)은 비목표라 건드리지 않음. 같은 원인이니 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "withDeadline은 이름과 달리 더 이상 시간을 강제하지 않는다. 느린 발송이 뒤 사람들을 미루는 문제는 지표로만 드러남"
  - "키가 기간+사용자라 ledgerTtlMs 안에서는 같은 기간 재발송이 막힘(의도). TTL이 기간보다 짧으면 재발송 가능"
recommended_next: null
knowledge_candidates:
  - "요약 발송 키에 runId를 넣으면 재실행/재시작/다중 서버에서 중복 방지가 안 된다. 키는 기간+사용자(src/digest/key.js)"
  - "요약 중복의 원인: withDeadline이 성공한 느린 발송에 예외를 던져 markSent 없이 재시도됨 (src/digest/deadline.js)"
---
## 요약
요약 중복의 원인 두 가지를 고쳤다. 느려도 성공한 발송을 timeout 예외로 처리해 재시도하던 것과, 발송 키에 runId가 들어 실행마다 키가 달라지던 것이다. 실패한 발송은 그대로 재시도된다. 회귀 테스트 3개를 추가했고 `npm test` 77개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js:39`.
- 테스트: `test/digest.test.js` 마지막 3개. 수정 전 74 통과/3 실패, 수정 후 77/0.
- 보고: `src/retry/policy.js` decide()에 같은 유형(일반 알림, 비목표라 미수정).
