---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "발송 키에서 runId를 빼고 기간+사용자로만 만든다"
    why: "재실행과 재시작에서도 같은 날 한 통만 가야 한다는 완료조건. 실행별 집계는 발송 기록의 runId로 유지"
    by: ai
  - what: "withDeadline은 성공하면 던지지 않고 slow 표시만 한다"
    why: "docs/knowledge/delivery/slow-success-is-success.md: 느리게 성공한 발송은 성공이다"
    by: ai
  - what: "같은 기간의 실행이 겹치면 runner가 하나로 합치고, scheduler는 실행이 끝난 뒤 lastPeriod를 기록한다"
    why: "동시 실행 중복과 도중 오류로 인한 하루 누락을 막는다. 이미 보낸 요약은 발송 기록이 막는다"
    by: ai
assumptions:
  - "운영의 발송 기록은 서버가 공유하는 DB라 같은 키 규칙이 서버 간에도 통한다고 본다(메모리 구현으로만 검증)"
rejected:
  - "어댑터가 두 번 보낸다: 호출 수 증가는 runner 재시도 때문"
  - "수신 dedupe 문제: 요약함 add는 한 번만 담음"
open_questions: []
intent_deviation: null
risks:
  - "src/retry/policy.js의 decide()는 일반 알림에서 같은 시간 초과 재시도 문제가 있으나 요약이 아니라 범위 밖. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "ETIMEDOUT처럼 오류로 끝났지만 서버가 실제로 보냈을 수 있는 경우는 멱등 키 없이는 중복을 막지 못함"
  - "다음 날 아침 일정이 하루 종일 돌지 않으면(서버 중단) 그 기간 요약은 자동으로 보충되지 않음"
recommended_next: null
knowledge_candidates:
  - "요약 발송 키는 기간+사용자로만 만든다. 실행 번호(runId)를 키에 넣으면 재실행/재시작 때 같은 요약이 또 나간다. 위치: src/digest/key.js"
  - "요약 scheduler는 실행이 끝난 뒤에 lastPeriod를 기록하고, 같은 기간 실행은 runner에서 합친다. 위치: src/digest/scheduler.js, src/digest/runner.js"
---
## 요약
요약 중복 발송의 원인 세 가지를 고쳤다. 키의 runId, 느린 성공을 시간 초과로 던지는 withDeadline, 일정의 lastPeriod 선기록이다. 경로별 테스트 8개를 추가했고 `npm test` 82개가 통과한다.
## 다음 task가 알아야 할 것
- 수정 파일: `src/digest/key.js`, `deadline.js`, `runner.js`, `scheduler.js`; 테스트는 `test/digest.test.js` 끝부분
- 수정 전 실패 6개(느린 성공 2통, 재실행 2통, 재실행+느린 성공 3통, 동시 2통, 재시도+느린 성공 3호출, 도중 오류 뒤 0통)
- `src/retry/policy.js`는 건드리지 않음(일반 알림, 범위 밖)
- `npm test`: 82 통과
