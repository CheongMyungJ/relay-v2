---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "재현 절차는 요청에 없어 fix 단계에서 직접 만든다고 가정"
  - "중복 원인은 발송 중복 방지(dedupe), 재시도, 다이제스트 경로 어디든 가능하다고 보고 범위를 좁히지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "요청에 재현 절차가 없어 원인 범위가 넓다"
recommended_next: null
knowledge_candidates: []
---
## 요약
중복 알림 버그의 의도 초안을 썼다. 재시도는 유지하고 실패 발송은 다시 보낸다는 조건을 넣었다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 관련 후보 위치(참고, 확인 안 됨): `src/dedupe/`, `src/retry/`, `src/dispatch/`, `src/adapters/mail.js`, `src/digest/`
- 팀 지식 항목 없음
