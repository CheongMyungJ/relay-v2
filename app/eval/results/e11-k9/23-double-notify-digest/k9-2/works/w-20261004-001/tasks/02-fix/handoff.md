---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 발송은 걸린 시간과 무관하게 성공으로 본다 (즉시 발송과 요약 발송 둘 다)"
    why: "원인이 두 경로에 같은 모양이고, 의도(성공 발송은 한 번)와 비목표(재시도 유지)를 모두 만족함"
    by: ai
assumptions:
  - "운영의 제한 시간 초과 성공이 중복의 실제 원인이라고 가정: 로그 없이 가상 시계 테스트로만 확인함"
rejected:
  - "dedupe 결함: 재시도 경로는 dedupe를 거치지 않고 동시 수신 테스트도 통과함"
  - "재시도 끄기/횟수 줄이기: 비목표이며 실제 실패는 다시 보내야 함"
open_questions: []
intent_deviation: null
risks:
  - "실패했지만 제한 시간을 넘긴 영구 오류(예: 550)는 여전히 timeout으로 재시도됨 (중복은 아니나 불필요한 재시도)"
  - "digest ledger 키에 runId가 들어 있어 서로 다른 run 사이에는 중복 방지가 안 됨 (이번 범위 밖)"
  - "withDeadline의 timeoutMs 인자가 미사용 상태로 남음"
recommended_next: null
knowledge_candidates:
  - "발송 성공 후 걸린 시간이 제한 시간을 넘었다고 실패로 재시도하면 중복 발송이 된다. 성공은 시간과 무관하게 성공이다: src/retry/policy.js decide, src/digest/deadline.js withDeadline"
  - "재시도 자체를 끄는 것은 해결이 아니다. 실제로 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
성공했지만 제한 시간(즉시 2000ms, 요약 3000ms)을 넘긴 발송을 timeout 실패로 보고 재시도해 중복이 났다. 성공이면 시간과 무관하게 끝으로 보도록 고쳤고, 실제 실패 재시도는 그대로다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js` decide, `src/digest/deadline.js` withDeadline
- 재현 테스트: `test/duplicate-send.test.js` (4개), `npm test` 78개 통과
- 기존 테스트는 변경하지 않음
- 남은 위험은 handoff risks 참고
