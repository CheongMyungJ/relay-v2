---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "일반 발송과 요약 발송 두 경로 모두에서 성공을 시간 초과보다 우선하게 고쳤다"
    why: "같은 원인이 두 경로에 있고, 완료조건이 메일 중복 전달 전체를 요구한다"
    by: ai
assumptions:
  - "실제 SMTP에서 느린 성공 응답은 이미 도착한 것이다. 어댑터가 ETIMEDOUT을 던지는 진짜 시간 초과는 도착 여부를 알 수 없어 지금처럼 재시도한다"
rejected:
  - "수신 중복 제거(dedupe) 결함: 한 이벤트의 발송이 반복되는 문제라 무관"
  - "요약 digestKey의 runId: 의도된 설계이고 같은 실행 안에서는 막힘"
open_questions: []
intent_deviation: null
risks:
  - "요약을 수동 재실행하면(runId가 달라서) 같은 기간 요약이 또 나갈 수 있다. 이번에는 건드리지 않음"
  - "진짜 시간 초과 오류(ETIMEDOUT) 뒤 재시도는 서버가 실제로 받았다면 중복될 수 있다. 멱등 키가 없어 남은 위험"
  - "기존 테스트는 바꾸지 않았다"
recommended_next: null
knowledge_candidates:
  - "성공한 발송은 걸린 시간과 상관없이 성공이다. 느렸다고 재시도하면 중복 알림이 된다 (src/retry/policy.js decide, src/digest/deadline.js)"
  - "재시도 자체를 끄는 것은 해결이 아니다. 실제로 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
같은 알림이 2~3번 가던 원인은, 발송이 성공했는데 제한 시간보다 오래 걸렸다는 이유로 시간 초과로 보고 다시 보낸 것이다. 일반 발송과 요약 발송 둘 다 고쳤다. 실패한 발송의 재시도는 그대로다.
## 다음 task가 알아야 할 것
- `src/retry/policy.js:14` `decide()`: 성공을 먼저 판정.
- `src/digest/deadline.js`: 성공이면 던지지 않고 `slow`만 돌려줌. `runner.js`에서 경고 로그.
- 테스트: `npm test` 79개 통과. 새 테스트 5개(notifier 2, retry 1, digest 2).
- 요약 수동 재실행 중복(runId 포함 키)은 범위 밖으로 남김.
