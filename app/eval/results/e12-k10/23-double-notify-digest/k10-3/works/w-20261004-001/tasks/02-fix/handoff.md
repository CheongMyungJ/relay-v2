---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "일반 발송과 요약 발송 두 경로를 모두 고친다"
    why: "같은 원인(성공했는데 느리면 timeout으로 재발송)의 메일 중복이라 범위 확장을 물었고 사람이 둘 다 고치라고 선택"
    by: human
  - what: "재시도는 그대로 두고 성공 결과를 시간 검사보다 먼저 본다"
    why: "재시도를 끄지 말라는 제약. 실제 실패(timeout 포함)는 계속 재시도"
    by: ai
assumptions:
  - "실제 운영에서도 메일 서버 응답이 제한 시간(2초)을 넘기는 일이 있어 중복이 생긴다고 본다(가상 시계로만 재현)"
rejected:
  - "dedupe 실패: 이벤트 한 번만 들어와도 중복이 생기고 dedupe는 수신 단계에서만 쓰임"
  - "재시도 워커 동시 실행: takeDue가 작업을 꺼내 지우므로 같은 작업이 두 번 처리되지 않음"
open_questions: []
intent_deviation: null
risks:
  - "실패한 발송이 제한 시간도 넘겼으면 영구 오류여도 timeout으로 재시도됨(policy.js 기존 동작, 중복 아님이라 그대로 둠)"
  - "느린 성공이 계속되면 발송이 오래 걸리는 것 자체는 감지만 하고(digest.slow) 막지 않음. 일반 발송에는 별도 지표 없음"
  - "실제로는 접수 후 응답이 유실된 진짜 timeout도 재발송될 수 있음(at-least-once, 이번 범위 아님)"
recommended_next: null
knowledge_candidates:
  - "발송 결과 판정은 성공 여부를 걸린 시간보다 먼저 본다. 성공을 timeout으로 바꾸면 재시도로 중복 발송된다: src/retry/policy.js, src/digest/deadline.js"
---
## 요약
성공한 발송이 제한 시간(2초)을 넘기면 실패로 보고 재시도해 같은 메일이 최대 3통 가던 버그를 고쳤다. 일반 발송과 요약 메일 둘 다 고쳤고, 재시도는 유지했다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js`(성공 먼저 판정), `src/digest/deadline.js`, `src/digest/runner.js`
- 테스트 4개 추가: test/notifier.test.js, test/digest.test.js. `npm test` 78 통과
- 요약 키(`src/digest/key.js`)에 runId가 들어 있어 실행을 다시 하면 같은 요약이 또 갈 수 있음(이번 범위 밖, 확인 안 함)
