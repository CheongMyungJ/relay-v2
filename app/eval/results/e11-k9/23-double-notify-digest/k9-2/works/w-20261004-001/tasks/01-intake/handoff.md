---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "질문 없이 초안을 작성했다"
    why: "초안 우선 모드이고, 요청이 기대 동작(중복 없음, 재시도 유지)을 이미 밝힘"
    by: ai
assumptions:
  - "재현 절차는 fix 단계에서 테스트로 만든다 (요청에 재현 절차가 없음)"
  - "푸시 채널도 중복 여부를 함께 확인한다 (요청은 메일이 더 잦다고만 함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원인을 아직 모르므로 digest, dedupe, retry 중 어디가 원인인지 범위가 fix에서 달라질 수 있음"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄는 것은 해결이 아니다. 실제로 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
중복 알림 버그 수정 의도를 초안으로 썼다. 재시도는 유지하고 중복만 없앤다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/`
- 관련 코드 후보 디렉터리(원인 확인 안 됨): `src/dedupe/`, `src/retry/`, `src/dispatch/`, `src/digest/`
