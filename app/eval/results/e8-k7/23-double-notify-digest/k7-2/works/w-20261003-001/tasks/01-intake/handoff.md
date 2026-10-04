---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "테스트 명령은 package.json의 `npm test`(node --test)로 본다"
  - "요청에 재현 절차가 없어 기본 항목 '재현 절차'는 fix에서 찾는 재현을 뜻한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원인을 아직 모르므로 완료조건의 테스트 항목은 fix에서 구체화될 수 있다"
recommended_next: null
knowledge_candidates:
  - "재시도 자체를 끄는 것은 중복 발송의 해결이 아니다. 실제 실패한 발송은 다시 보내야 한다 (사람)"
---
## 요약
중복 알림(2~3회, 메일에서 더 잦음) 버그의 의도 초안을 썼다. 재시도는 유지하고 실패 발송은 재전송한다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (node --test), `test/` 아래에 dedupe, digest 등 테스트가 있다.
- 관련 후보 디렉터리(참고만, 원인 확인 안 됨): `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/adapters/mail.js`
- 팀 지식(`docs/knowledge/`) 항목은 없었다.
