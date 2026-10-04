---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느리게 성공한 발송은 시간 초과 실패가 아니라 성공으로 처리한다"
    why: "메일이 이미 나간 뒤 재시도하면 중복이 된다. 진짜 오류(ETIMEDOUT 등)는 여전히 transient로 재시도한다"
    by: ai
  - what: "중복 방지 키에서 runId를 뺀다"
    why: "같은 고객·같은 날짜는 실행과 무관하게 한 번만 보내야 한다는 intent"
    by: ai
assumptions:
  - "운영 ledger가 공유 DB여도 has/markSent 사이 경쟁은 남을 수 있다. inFlight 방지는 프로세스 내부만 막는다"
rejected:
  - "src/retry·src/dedupe 공유 코드가 원인: 요약 runner는 사용하지 않음"
  - "스케줄러가 한 프로세스에서 같은 기간을 두 번 돌림: lastPeriod를 await 전에 설정해 막힘"
open_questions: []
intent_deviation: null
risks:
  - "다중 서버에서 동시에 같은 요약을 보내는 경쟁은 공유 DB의 원자적 선점(claim)이 있어야 완전히 막힌다. 이번엔 프로세스 내 inFlight만"
  - "진짜 응답 없음(ETIMEDOUT)으로 결과가 불확실한 경우 재시도하면 중복 가능성이 남는다. 재시도 유지 제약상 그대로 둠"
  - "scheduler의 lastPeriod는 메모리라 재시작 시 초기화된다. ledger 키(3일 TTL)가 막음"
recommended_next: null
knowledge_candidates:
  - "요약 중복 방지 키는 기간+사용자만으로 만든다. runId를 넣으면 재실행마다 중복 발송된다 (src/digest/key.js)"
  - "요약 발송이 제한 시간(sendTimeoutMs)보다 느리게 성공해도 시간 초과 실패로 보면 안 된다. 이미 나간 메일을 재시도해 최대 maxAttempts통이 나갔다 (src/digest/deadline.js)"
---
## 요약
중복 원인 두 가지를 고쳤다: 키의 runId, 느린 성공을 시간 초과로 처리해 재시도한 것. 3통은 후자가 maxAttempts(3)번 반복된 경우다. 재시도는 그대로다. 경로별 근거는 아래 테스트.
## 다음 task가 알아야 할 것
- 커밋은 relay/w-20261004-002 브랜치. `npm test` 80 pass.
- 경로별 "한 번만" 근거(test/digest.test.js): 최초 발송=`중복 방지(최초 발송)…`, 재시도=`중복 방지(재시도)…` 2건, 스케줄러 재실행=`중복 방지(스케줄러 재실행)…`, 겹치는 실행=`중복 방지(겹치는 실행)…`, 실패 뒤 재전달=`한 실행이 실패해도 다른 실행이…`.
- 수정 전 4건 실패 확인(`git checkout 6ea77c6 -- src`).
- 코드: src/digest/key.js, deadline.js, runner.js(inFlight).
