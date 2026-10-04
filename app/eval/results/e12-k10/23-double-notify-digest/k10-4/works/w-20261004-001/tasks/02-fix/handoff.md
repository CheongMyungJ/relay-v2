---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 발송은 걸린 시간과 상관없이 성공으로 처리한다 (바로 보내기와 요약 두 경로 모두)"
    why: "의도: 성공한 발송이 있으면 한 번만 전달. 두 경로가 같은 원인이라 함께 고침"
    by: ai
assumptions:
  - "느린 성공도 실제로 전달된 것으로 본다"
rejected:
  - "메일 어댑터 타임아웃 오류가 전달됐는데 재시도된다는 가설: 이번 재현은 성공 응답 뒤 재발송이라 다른 원인. 전달 여부를 모르는 오류는 멱등 키가 필요해 범위 밖"
open_questions: []
intent_deviation: null
risks:
  - "진짜 ETIMEDOUT처럼 전달 여부가 모호한 실패는 여전히 재시도되어 드물게 중복 가능"
  - "요약의 digestKey에 runId가 들어가 있어 다른 runId로 같은 기간을 다시 돌리면 중복 발송될 수 있음(이번에 건드리지 않음)"
  - "withDeadline의 timeoutMs 인자는 이제 쓰이지 않음"
recommended_next: null
knowledge_candidates:
  - "성공한 발송을 걸린 시간 때문에 실패로 뒤집으면 재시도가 중복 발송을 만든다. 위치: src/retry/policy.js decide, src/digest/deadline.js withDeadline"
---
## 요약
느리게 성공한 발송(제한 시간 초과)을 실패로 보고 재발송하던 것이 중복의 원인이었다. 바로 보내기(`decide`)와 요약(`withDeadline`) 두 곳을 고쳤고, 실패 재시도는 유지된다. `npm test` 78건 통과.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js`(ok 먼저 검사), `src/digest/deadline.js`(성공을 뒤집지 않음)
- 테스트: `test/duplicate-send.test.js`, 수정 전 3건 실패
- 커밋: b537cd2
- 남은 위험: digestKey의 runId, 모호한 ETIMEDOUT 재시도
