---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "발송 키에서 runId를 빼고 기간+사용자만으로 만든다"
    why: "같은 날짜 요약은 어느 실행에서든 한 통이어야 함. 실행별 건수는 ledger의 runId로 계속 셈"
    by: ai
  - what: "제한 시간을 넘긴 성공은 sent로 기록하고 slow 표시만 한다"
    why: "팀 지식 docs/knowledge/delivery/success-before-timeout.md: 성공을 시간보다 먼저 본다"
    by: ai
  - what: "스케줄러는 바꾸지 않는다(실패분은 같은 기간 run() 재실행 때 재발송)"
    why: "실패 요약 자동 재시도 주기는 동작 변경이라 범위 밖. 재실행하면 받은 사람은 건너뛰고 실패분만 나감"
    by: ai
assumptions:
  - "운영의 발송 기록(ledger)은 서버들이 공유하고 TTL(3일) 안에는 키가 남는다고 가정"
rejected:
  - "요약함에 같은 이벤트가 두 번 담김: inbox.add가 source/id로 막음"
  - "같은 프로세스에서 스케줄러가 하루 두 번 돎: lastPeriod를 await 전에 정해 막힘"
open_questions: []
intent_deviation: null
risks:
  - "스케줄러는 실패한 요약을 자동으로 다시 시도하지 않음(lastPeriod가 이미 정해짐). 재발송은 같은 기간 run() 재실행이 필요함"
  - "서버 둘이 동시에 같은 기간을 돌리면 키 기록 전에 둘 다 보낼 수 있음(공유 DB 원자적 확인은 이번 범위 밖)"
  - "앞 Work(w-20261004-001)에서 알림 쪽 src/retry/policy.js를 고쳤을 수 있음, 머지 대기(이번엔 건드리지 않음)"
  - "발송 어댑터가 성공했는데 오류를 던지는 경우(응답 유실)는 구분할 수 없어 재시도됨"
recommended_next: null
knowledge_candidates:
  - "요약 발송 키(digestKey)에는 runId를 넣지 않는다. 실행마다 키가 달라지면 재실행·재시작 때 이미 보낸 요약이 또 나간다: src/digest/key.js"
  - "요약 발송 제한 시간(sendTimeoutMs)을 넘긴 성공은 실패가 아니라 slow 표시만 한다: src/digest/deadline.js"
---
## 요약
요약 메일 중복의 원인 두 가지를 고쳤다. 느린 성공을 시간 초과로 봐 재시도하던 것과, 발송 키에 runId가 있어 재실행 때 또 보내던 것이다. 경로별 테스트 7건을 추가했고 `npm test` 81건이 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js`
- 테스트: `test/digest.test.js` 끝부분. 경로별 이름 `[첫 발송]`, `[느린 성공]`, `[느린 성공이 반복]`, `[실패 후 재시도]`, `[스케줄러 재실행]`, `[재발송]`
- 수정 전 새 테스트 5건 실패, 수정 후 모두 통과
- 스케줄러 자동 재시도는 만들지 않았음(risks 참고)
