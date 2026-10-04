---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "중복 방지를 즉시 발송, 요약, 이벤트 중복 제거 네 경로 모두에서 고쳤다"
    why: "완료조건이 재시도나 재처리가 일어나도 다시 발송되지 않는 것(메일, 그 밖의 채널 모두)이고, 네 경로 모두 같은 증상으로 재현됨"
    by: ai
  - what: "요약 키에서 runId를 뺐다"
    why: "runId가 키에 있으면 재실행 때 이미 보낸 요약을 알아볼 수 없다. 실행별 집계는 ledger 기록의 runId 필드로 가능"
    by: ai
  - what: "느리게 끝난 성공은 오류가 아니라 성공으로 처리하고 요약은 경고 로그만 남긴다"
    why: "이미 간 알림은 되돌릴 수 없고, 진짜 실패의 재시도는 그대로 유지"
    by: ai
assumptions:
  - "메일에서 더 자주 나타나는 이유는 메일 전송이 푸시보다 느려 제한 시간을 넘기기 쉽기 때문이라고 추정한다 (운영 지연 값은 확인하지 못함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "요약 키가 runId 없이 기간과 사용자뿐이라, 같은 기간에 일부러 다시 보내려면 ledger 보낸 키(보관 3일)가 지나야 한다"
  - "수신 시각을 dedupe 키에서 뺐으므로 같은 id의 이벤트는 24시간 창 안에서 항상 중복으로 본다 (내용이 다르게 고쳐 다시 온 이벤트도 포함)"
  - "제한 시간을 넘긴 성공을 요약 발송은 막지 못하고 경고만 남긴다 (취소 불가)"
recommended_next: null
knowledge_candidates:
  - "발송 성공 판정은 걸린 시간보다 앞선다. 느리게 끝난 성공을 timeout으로 재시도하면 중복 발송이 된다 (src/retry/policy.js, src/digest/deadline.js)"
  - "중복 제거와 요약의 키에는 매번 달라지는 값(수신 시각, runId)을 넣지 않는다 (src/dedupe/key.js, src/digest/key.js)"
---
## 요약
중복 발송 원인 네 가지를 찾아 고쳤다. 느리게 성공한 발송을 실패로 보고 재시도함(즉시 발송과 요약), 수신 시각이 든 dedupe 키, runId가 든 요약 키. 실제 실패의 재시도는 그대로이고 `npm test` 82개가 통과한다.
## 다음 task가 알아야 할 것
- 재현 테스트: `test/no-double-send.test.js` (수정 전 5개 실패, 수정 후 통과)
- 수정: `src/retry/policy.js:13`, `src/dedupe/key.js`, `src/digest/key.js`, `src/digest/deadline.js`, `src/digest/runner.js`
- 기존 테스트는 바꾸지 않았다. 커밋은 작업 브랜치 `relay/w-20261004-001`에 하나
- 검증이 볼 곳: 같은 id 이벤트가 24시간 안에 내용만 바뀌어 오는 경우의 동작(리스크 2번)
