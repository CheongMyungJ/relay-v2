---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느린 성공은 성공으로 보고(withDeadline이 오류를 던지지 않음), 발송 키에서 runId를 뺀다"
    why: "팀 지식 docs/knowledge/notify/slow-success-is-success.md와 같은 원인이 이 코드에서도 확인됨. 재시도는 유지(retry-keeps-real-failures.md)"
    by: ai
assumptions:
  - "같은 기간 재실행(재시작, 다중 서버)이 실제 운영에서 중복의 일부일 수 있다고 보고 키 수정도 함께 적용"
rejected:
  - "재시도 끄기/횟수 줄이기: 제약과 팀 지식에 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 같은 수정을 했을 수 있음, 머지 대기. 머지 시 deadline.js, key.js 충돌 가능"
  - "발송 기록 키가 runId 없이 기간+사용자라, 실패 후 같은 기간을 재실행하면 보낸 적 없는 사용자만 다시 보냄(의도한 동작)"
  - "소켓 ETIMEDOUT처럼 실제 오류인데 서버가 이미 전달했을 수 있는 경우는 여전히 재시도로 중복 가능"
recommended_next: null
knowledge_candidates:
  - "느린 성공을 시간 초과 실패로 보면 중복 발송됨: src/digest/deadline.js의 withDeadline이 원인이었고 오류로 바꾸지 않게 고침. 회귀 테스트 test/no-double-send.test.js"
  - "요약 발송 키(digestKey, src/digest/key.js)에 runId를 넣지 않는다. 실행별 건수는 entries의 runId로 센다"
---
## 요약
요약 중복의 원인은 두 가지였다. 느리게 성공한 발송을 시간 초과로 보고 재시도한 것, 그리고 발송 키에 runId가 있어 재실행 때 중복 방지가 안 된 것. 둘 다 고쳤고 재시도는 그대로다. 테스트 77개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js`
- 회귀 테스트: `test/no-double-send.test.js` (느린 성공, 재실행, 실제 오류 재시도)
- 테스트: `npm test` 77/77 통과
