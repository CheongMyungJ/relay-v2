---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "실패한 요약은 재시도, 하루 건너뛰기 금지를 완료조건과 제약에 넣는다"
    why: "요청 원문의 명시 조건"
    by: human
assumptions:
  - "요약 중복 발송은 수신자당 하루 한 통이 기대 동작이라고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261003-001)에서 왔고 머지 대기라 이 브랜치에는 해당 수정과 docs/knowledge 파일이 아직 없다. 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그 수정 intent 초안을 썼다. 원인은 적지 않았다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (node --test), 코드는 src/digest, src/retry, src/dispatch 등.
- 참고(원인 근거 아님): 팀 지식 `docs/knowledge/successful-send-is-never-timeout.md` (기준 브랜치에 아직 없음, 앞 Work w-20261003-001). 성공 발송을 timeout으로 보는 실패 유형이 요약 중복과 닮았으니 `src/retry/policy.js`, `src/digest/deadline.js`를 확인해 볼 만하다. 이번 코드에서 직접 확인할 것.
