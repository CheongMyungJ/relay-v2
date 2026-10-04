---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 발송은 느려도 성공으로 보고, 요약 경로는 던지지 않고 slow 지표만 남긴다"
    why: "메일이 이미 전달됐으므로 다시 보내면 중복. 실패한 발송의 시간 초과 재시도는 유지(비목표)"
    by: ai
assumptions:
  - "운영의 중복 원인도 느린 SMTP 응답이라고 보았다. 운영 로그로는 확인하지 못함"
rejected:
  - "dedupe 키가 느슨하다: 발송 후 재발송을 설명하지 못함"
  - "재시도 큐가 job을 두 번 꺼냄: takeDue가 shift로 꺼냄"
open_questions: []
intent_deviation: null
risks:
  - "digestKey에 runId가 들어 있어 같은 기간을 다른 runId로 다시 돌리면(재시작, 서버 여러 대) 원장 중복 방지가 듣지 않는다. 이번 재현과 무관해 손대지 않음"
  - "실패 후 시간 초과 판정은 그대로라, 영구 오류도 느리면 재시도된다(중복은 아님)"
  - "클라이언트 쪽 제한 시간 초과로 끊긴 요청이 서버에서는 성공한 경우는 코드로 알 수 없어 남는다"
recommended_next: null
knowledge_candidates:
  - "중복 알림 원인: 성공한 발송이 제한 시간(send.timeoutMs 2000, digest.sendTimeoutMs 3000)을 넘으면 시간 초과로 보고 재시도했다. 위치 src/retry/policy.js decide, src/digest/deadline.js"
---
## 요약
느리게 성공한 발송을 시간 초과 실패로 보고 다시 보내던 것이 중복 수신의 원인이었다. 일반 발송과 요약 두 곳을 고쳤고 재시도는 그대로다. `npm test` 79개 모두 통과.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js:decide`, `src/digest/deadline.js`, `src/digest/runner.js`
- 신규 테스트: `test/duplicate-send.test.js` (수정 전 3개 실패)
- 남은 위험: `src/digest/key.js`의 runId 포함 키
