---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도는 유지하고 중복 발송만 없애는 것을 목표로 한다"
    why: "요청: 재시도 자체를 끄면 안 되고 실제 실패한 발송은 다시 보내야 한다"
    by: human
assumptions:
  - "중복은 메일과 그 외 채널 모두에서 가능하다고 보고 완료조건을 채널 공통으로 썼다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "재현 절차가 요청에 없어 fix 단계에서 재현 방법을 새로 만들어야 한다"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄는 것은 중복 발송의 해결이 아니다. 실제 실패한 발송은 반드시 다시 보낸다 (사람)"
---
## 요약
중복 알림 버그 수정 intent 초안을 썼다. 재시도는 유지하고 중복만 없앤다.
## 다음 task가 알아야 할 것
- 테스트 명령은 `npm test`이다 (`node --test`, `test/` 디렉터리).
- 코드 구조상 관련 후보 영역은 `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/digest/`이다. 훑어보기만 했고 원인 가설은 아니다.
