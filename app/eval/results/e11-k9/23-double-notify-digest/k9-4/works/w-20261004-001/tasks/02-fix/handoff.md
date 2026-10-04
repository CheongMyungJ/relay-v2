---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 경로(digest)의 같은 결함도 함께 고친다"
    why: "같은 원인(느린 성공을 시간 초과로 처리)이며 요약 메일 중복 발송도 이번 버그의 범위"
    by: ai
assumptions:
  - "운영의 중복도 메일 응답이 제한 시간(2초, 요약은 3초)을 넘긴 성공 때문이라고 봄. 운영 로그로는 확인하지 못함"
rejected:
  - "dedupe 결함: 수신 중복 제거는 정상이고 중복은 발송 단계에서 생김"
  - "재시도 큐가 같은 job을 두 번 꺼냄: takeDue가 꺼내며 제거함"
open_questions: []
intent_deviation: null
risks:
  - "느리게 실패한 영구 오류는 여전히 시간 초과로 보아 재시도됨(기존 동작 유지, 중복은 아님)"
  - "digest key에 runId가 들어가 같은 기간을 run()으로 직접 다시 돌리면 다른 실행으로 보아 재발송 가능(이번 원인 아님, 수정 안 함)"
  - "발송 성공이 실제로는 제한 시간 뒤 응답이라 호출자가 이미 포기한 경우는 다루지 않음"
recommended_next: null
knowledge_candidates:
  - "발송 판정은 성공 여부를 걸린 시간보다 먼저 본다. 느린 성공을 시간 초과로 재시도하면 중복 발송이 된다: src/retry/policy.js, src/digest/deadline.js"
---
## 요약
느리게 성공한 발송을 시간 초과로 판정해 재시도하던 것이 중복 발송의 원인이었다. 디스패처(`decide`)와 요약(`withDeadline`) 두 곳을 고쳤고 재현 테스트와 재시도 유지 테스트를 추가했다. `npm test` 77개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js`(성공 먼저 판정), `src/digest/deadline.js`(성공은 느려도 반환, `slow` 플래그)
- 테스트: `test/notifier.test.js`, `test/digest.test.js` 끝부분 추가분
- 커밋 90c0688, 테스트 명령 `npm test`
- 기존 테스트는 바꾸지 않음
