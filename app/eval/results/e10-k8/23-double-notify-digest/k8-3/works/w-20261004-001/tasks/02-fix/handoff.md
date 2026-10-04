---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "요약 메일 경로(digest/deadline.js)도 같은 원인이라 함께 고쳤다"
    why: "같은 알림이 중복 발송되는 같은 결함이고 메일 중복 범위에 속한다"
    by: ai
assumptions:
  - "운영의 느린 응답이 제한 시간(2초/3초)을 넘는 성공이 중복의 주된 원인이라고 가정. 운영 로그는 보지 못함"
rejected:
  - "dedupe 키 문제: 키가 안정적이고 동시 수신 시험이 통과"
  - "재시도 큐 중복 등록: 꺼낸 일만 다시 넣는 구조"
open_questions: []
intent_deviation: null
risks:
  - "요약 키에 runId가 있어 프로세스 재시작이나 수동 재실행 시 같은 기간 요약이 다시 갈 수 있음(이번 수정 범위 밖)"
  - "실제 시간 초과 실패 후 재시도 시, 서버가 사실은 보냈던 경우의 중복은 어댑터 단에서 막을 수 없음"
recommended_next: null
knowledge_candidates:
  - "발송이 성공했으면 걸린 시간이 제한 시간을 넘어도 실패로 보고 재시도하지 않는다. 시간 초과는 실제 실패일 때만 재시도 사유다 (src/retry/policy.js, src/digest/deadline.js)"
---
## 요약
성공한 발송을 느리다는 이유로 시간 초과 실패로 처리해 다시 보내던 것이 중복 발송의 원인이었다. 일반 발송과 요약 메일 두 경로를 고쳤고 재현 테스트가 수정 전 실패, 후 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js` decide의 성공 우선 검사, `src/digest/deadline.js`, `src/digest/runner.js`
- 테스트: `npm test` 80건 통과. 새 테스트는 test/retry, notifier, digest.test.js 끝부분
- 재시도 정책(횟수·백오프)은 변경 없음
