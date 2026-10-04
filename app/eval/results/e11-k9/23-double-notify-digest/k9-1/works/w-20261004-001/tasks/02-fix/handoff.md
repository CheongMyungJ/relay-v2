---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 발송은 느려도 성공으로 본다 (decide와 withDeadline 두 곳 모두 수정)"
    why: "이미 전달된 메시지를 시간 초과로 재시도하면 중복 발송이 된다. 실제 실패의 재시도는 그대로 둔다"
    by: ai
assumptions:
  - "제한 시간 초과로 던져진 오류(ETIMEDOUT 등)는 전달 여부를 알 수 없어 지금처럼 재시도한다 (이 경우의 중복 가능성은 남음)"
rejected:
  - "dedupe 키/저장소 결함: 재시도 경로는 dedupe를 거치지 않아 이 증상과 무관"
  - "재시도 워커 동시 실행: takeDue가 job을 제거하므로 같은 job이 두 번 돌지 않음"
open_questions: []
intent_deviation: null
risks:
  - "src/digest/key.js: 요약 키에 runId가 들어가 있고 runId 기본값이 시각이라, 같은 기간을 다시 run하면(재시작·다중 서버) 요약이 또 나갈 수 있다. 의도된 설계로 보여 이번에 바꾸지 않음"
  - "ETIMEDOUT처럼 소켓 시간 초과 뒤 실제로는 전달됐을 수 있는 경우의 중복은 남음 (멱등 키 필요)"
  - "withDeadline의 timeoutMs 인자는 이제 쓰이지 않음"
recommended_next: null
knowledge_candidates:
  - "발송 성공 여부와 소요 시간 초과를 섞으면 안 된다: 성공했는데 느리다고 재시도하면 중복 발송이 된다. 위치: src/retry/policy.js decide, src/digest/deadline.js withDeadline"
---
## 요약
성공했지만 제한 시간(발송 2초, 요약 3초)을 넘긴 발송을 실패로 보고 재시도해 같은 알림이 2~3번 가던 것을 고쳤다. 메일이 느려 더 자주 걸렸다. 재시도 자체와 실제 실패 재시도는 그대로다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js`(decide), `src/digest/deadline.js`(withDeadline)
- 새 테스트: `test/slow-success.test.js` (수정 전 3개 실패 확인)
- `npm test` 78개 통과
- 남은 위험: `src/digest/key.js` runId 포함 키, 소켓 시간 초과 뒤 실제 전달된 경우
