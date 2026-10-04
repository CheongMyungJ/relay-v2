---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느린 성공은 성공으로 보고, 제한 시간 초과는 slow 표시와 지표·로그로만 남긴다"
    why: "팀 지식 docs/knowledge/delivery/success-beats-timeout.md: 성공 판정은 걸린 시간보다 앞선다"
    by: ai
  - what: "요약 키에서 runId를 빼고 실행별 집계는 ledger 기록의 runId로 한다"
    why: "팀 지식 docs/knowledge/delivery/success-beats-timeout.md: 매번 달라지는 값을 키에 넣지 않는다"
    by: ai
  - what: "재시도는 그대로 두고, 성공 후 재발송 없음과 실제 실패 재발송을 둘 다 테스트한다"
    why: "팀 지식 docs/knowledge/delivery/real-failures-must-be-resent.md"
    by: ai
assumptions:
  - "발송 기록(ledger)의 보낸 키 보관 기간(ledgerTtlMs)이 같은 기간 재실행을 막기에 충분하다고 봄"
rejected:
  - "재시도 횟수·간격 조정: 중복은 성공 뒤에 생기고 재시도를 줄이는 것은 제약 위반"
open_questions: []
intent_deviation: null
risks:
  - "src/retry/policy.js의 decide도 성공이어도 timeout이면 재시도하는 구조인데, 이번 요청(요약) 밖이라 건드리지 않음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "ledger의 keyed TTL이 지난 뒤 같은 기간을 재실행하면 다시 보낼 수 있음"
recommended_next: null
knowledge_candidates:
  - "요약 메일 중복 발송을 해결할 때 재시도를 끄는 것은 해결이 아니다. 실제로 못 보낸 요약은 다시 보내야 한다 (사람)"
  - "요약 발송 키(src/digest/key.js)에 runId 같은 실행마다 달라지는 값을 넣으면 재실행 중복을 못 막는다. 실행별 집계는 ledger 기록의 runId로 한다"
---
## 요약
요약 메일 중복의 원인 두 가지를 고쳤다. 느리게 성공한 발송을 타임아웃 오류로 던져 재시도하던 것과, 요약 키에 runId가 들어가 재실행을 알아보지 못하던 것이다. 재시도는 그대로이고 테스트 3개를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`(slow만 반환), `src/digest/key.js`, `src/digest/runner.js`
- 테스트: `npm test` 77개 통과, 새 테스트는 `test/digest.test.js` 끝 3개, 수정 전 3개 실패 확인
- 기존 테스트는 바꾸지 않음
