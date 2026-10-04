---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느린 성공은 실패가 아닌 slow 지표로만 남기고, 요약 발송 키에서 runId를 뺀다"
    why: "팀 지식 docs/knowledge/slow-success-is-not-failure.md, docs/knowledge/no-disable-retry-for-duplicates.md: 성공 판정을 먼저 하고 재시도는 유지"
    by: ai
  - what: "일반 알림 발송 경로(src/retry/policy.js decide)는 이번에 고치지 않는다"
    why: "intent 비목표: 요약 발송과 무관한 변경은 하지 않음"
    by: ai
assumptions:
  - "요약이 다시 나갈 수 있는 경로는 같은 실행 안의 재시도와 재실행(scheduler 재시작, 수동 digest.run) 두 가지로 보았다"
rejected:
  - "재시도 횟수·활성 설정 변경: 비목표이자 팀 규칙, 설정은 기준과 동일"
  - "운영 제한 시간 설정 변경이 원인: 레포에서 확인 불가, 원인 구조는 설정과 무관"
open_questions: []
intent_deviation: null
risks:
  - "src/retry/policy.js decide()도 같은 결함(시간 초과 판정이 성공 판정보다 먼저)이 있어 일반 알림은 여전히 중복될 수 있음. 범위 밖이라 두었고, 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "ledger는 메모리라 프로세스 재시작 뒤에는 보낸 키가 사라진다. 운영의 공용 DB 기록이 있으면 효과가 있고, 이 레포에서는 확인하지 못함"
  - "신고된 3~4초 간격 중복은 요약 경로(재시도 60초)가 아닌 일반 발송 경로와 맞아 보인다. 요약 중복 보고가 같은 원인인지 운영 확인이 필요"
recommended_next: null
knowledge_candidates:
  - "요약 발송의 이미 보냈는지 키에 runId를 넣으면 재실행마다 중복 확인이 무효가 된다. 실행별 집계는 ledger 항목의 runId로 한다. (src/digest/key.js)"
  - "요약 withDeadline은 성공 뒤 시간 초과 오류를 던지지 않고 slow만 표시한다. 재시도 활성 설정은 건드리지 않는다. (src/digest/deadline.js)"
---
## 요약
요약 메일 중복의 원인 두 가지를 고쳤다. (a) 성공한 발송이 3초보다 느리면 실패로 보고 재시도하던 것, (b) 보낸 키에 runId가 있어 재실행 때 중복 확인이 무효이던 것. 재시도 설정은 기준과 같다. 실제 실패는 여전히 재시도되어 한 번 전달된다.
## 다음 task가 알아야 할 것
- 변경: `src/digest/deadline.js`, `key.js`, `runner.js`; 테스트는 `test/digest.test.js` 끝 5건 추가.
- `npm test`: 79 통과(기준 74). 수정 전 새 테스트 4건 실패 확인.
- 일반 발송 `src/retry/policy.js:14-` 의 `decide`는 그대로이며 같은 결함이 남아 있음(범위 밖).
- 기존 테스트 변경 없음.
