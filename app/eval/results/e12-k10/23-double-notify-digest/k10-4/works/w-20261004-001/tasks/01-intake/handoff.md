---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "재현 절차는 요청에 없어, fix에서 중복 발송을 재현하는 테스트를 만드는 것을 완료조건에 넣었다"
  - "요청 문장이 명확해 사람에게 따로 묻지 않고 초안을 썼다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원인이 한 곳이 아닐 수 있다(메일이 더 잦다는 점). 여러 경로가 겹치면 fix가 범위를 다시 확인해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
중복 알림 발송(메일이 더 잦음) 버그 수정의 의도 초안을 썼다. 재시도는 유지하고, 실패한 발송만 재발송하도록 한다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/`에 있다.
- 코드는 읽지 않았다. 수정 대상 후보 디렉터리(참고용 추정): `src/dedupe/`, `src/retry/`, `src/dispatch/`, `src/adapters/mail.js`.
- 가설(확인 안 됨): 메일 어댑터가 타임아웃 같은 모호한 실패를 던져도 실제로는 전달되어, 재시도가 중복을 만들 수 있다.
