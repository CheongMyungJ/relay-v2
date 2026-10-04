---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느린 성공은 실패로 보지 않고 slow 표시(지표 digest.slow, 경고 로그)만 한다"
    why: "팀 지식 docs/knowledge/retry/slow-success-is-not-failure.md. 재시도를 끄거나 줄이지 않고 원인을 고침"
    by: ai
  - what: "요약 키에서 runId를 빼 기간+사용자로만 정한다"
    why: "runId 때문에 재실행·재시작마다 키가 달라져 중복 방지가 무력했음. 실행별 집계는 기록의 runId로 유지"
    by: ai
  - what: "보내는 중인 키를 선점(claim)해 겹친 실행의 이중 발송을 막는다"
    why: "has 검사와 markSent 사이에 await가 있어 동시 실행이 둘 다 보냄"
    by: ai
assumptions:
  - "운영의 ledger는 서버들이 같이 쓰는 DB라 재시작 뒤에도 남는다(README/주석 기준). 메모리 구현에서는 재시작 시 기록이 사라짐"
rejected:
  - "재시도 횟수·재시도 기능 축소: 제약 위반이며 원인도 아님"
  - "일반 알림 경로(src/retry/policy.js) 수정: 비목표, 앞 Work 담당"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/retry/policy.js decide의 느린 성공 시간 초과 판정. 이 브랜치에서는 건드리지 않음"
  - "실제 시간 초과로 실패했지만 서버는 이미 보낸 경우의 중복은 막을 수 없다(재시도가 보냄). 헤더 X-Notify-Digest는 기간/사용자로 안정적이라 중계 서버 단 중복 제거에 쓸 수 있음"
  - "claim은 프로세스 메모리 기준. 여러 서버가 동시에 돌면 공유 DB의 원자적 선점이 필요"
  - "느린 발송이 뒤 사용자를 밀리게 하는 문제는 slow 지표로 보게만 했고 별도 대응은 없음"
recommended_next: null
knowledge_candidates:
  - "요약 키는 기간+사용자만으로 정한다. runId를 넣으면 재실행·재시작 때 같은 기간 요약이 다시 나간다. 실행별 집계는 기록의 runId로 센다 (src/digest/key.js)"
  - "요약 발송은 보내기 전에 ledger.claim으로 선점하고 실패 시 release한다. 겹쳐 도는 실행의 중복을 막는다 (src/digest/ledger.js)"
  - "요약 중복은 재시도를 끄거나 줄이는 것으로 해결하지 않으며, 실제 실패한 요약은 재시도로 다시 가야 하고 하루 건너뛰면 안 된다 (사람)"
---
## 요약
요약 중복의 원인 셋을 고쳤다: 느린 성공을 시간 초과 실패로 봐 재시도함(2~3통), 키의 runId 때문에 재실행·재시작 시 키가 달라짐, 겹쳐 도는 실행의 동시 발송. 재시도 횟수와 기능은 그대로이고 실제 실패는 계속 재시도된다. 경로별 테스트 8건 추가, `npm test` 82개 통과(수정 전 새 테스트 5건 실패).
## 다음 task가 알아야 할 것
- 커밋 48b0ae4. 변경: `src/digest/{deadline,key,ledger,runner}.js`, `test/digest.test.js`.
- 테스트: `npm test`. 가짜 메일 `outcomes: [{ latencyMs: 3500 }]`로 느린 성공 재현.
- `withDeadline`은 이제 `{ value, elapsedMs, slow }` 반환, 던지지 않음.
- 일반 알림의 `src/retry/policy.js`는 의도적으로 미변경.
