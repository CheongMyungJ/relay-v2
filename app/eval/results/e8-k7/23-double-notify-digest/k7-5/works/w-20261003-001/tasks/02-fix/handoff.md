---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약의 중복 방지 키에서 runId를 뺐다"
    why: "같은 기간을 재실행하면 runId가 달라 이미 보낸 요약을 또 보냈다. 같은 중복 발송 버그의 한 경로라 범위 안으로 봤다"
    by: ai
assumptions:
  - "요약 발송은 제한 시간을 넘겨도 성공이면 전달된 것으로 본다"
rejected:
  - "dedupe 키/저장소 결함: 재현 경로에서 같은 이벤트는 정상적으로 막힘"
  - "재시도 큐/워커의 중복 꺼냄: takeDue가 shift로 꺼내 중복 없음"
open_questions: []
intent_deviation: null
risks:
  - "요약 보낸 키 형식이 바뀌어, 배포 직후 이미 저장된 옛 키(runId 포함)가 있으면 그 기간은 한 번 더 보낼 수 있다(운영은 DB 공유라고 주석에 있음)"
  - "느리게 성공한 발송은 이제 지연을 실패로 보지 않는다. 실제로는 전달 안 됐는데 성공 응답이 온 경우는 다루지 않는다"
recommended_next: null
knowledge_candidates:
  - "성공한 발송은 걸린 시간이 제한을 넘어도 재시도하지 않는다. 시간 초과는 어댑터가 오류를 던졌을 때만 재시도 사유다"
  - "요약 중복 방지 키(src/digest/key.js)에 runId를 넣으면 재실행 때 중복 발송된다"
---
## 요약
원인은 두 가지다. 발송이 성공했는데 느렸다는 이유로 실패 처리해 재시도한 것(일반 발송과 요약 모두), 그리고 요약 보낸 키에 runId가 들어가 재실행 때 중복 방지가 안 된 것. 둘 다 고쳤고 재현 테스트를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js`(성공 우선), `src/digest/deadline.js`(오류 안 던짐, `slow` 반환), `src/digest/key.js`(runId 제거)
- 테스트: `test/duplicate-send.test.js` 5개. 수정 전 4개 실패. `npm test` 79개 통과
- 실제 시간 초과 오류의 재시도는 유지됨(같은 파일 3번째 테스트)
