---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "재현 절차는 요청에 없어, 중복 발송을 재현하는 테스트를 fix에서 만드는 것으로 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원인을 확인하지 않았다. 재현 조건(채널, 빈도)은 요청 원문의 설명뿐이다"
recommended_next: null
knowledge_candidates:
  - "재시도를 끄는 것은 중복 발송의 해결이 아니다. 실제로 실패한 발송은 반드시 재발송한다 (사람)"
---
## 요약
중복 알림(2~3회, 메일에서 더 잦음) 버그 수정 의도를 정리했다. 재시도는 유지하고 실제 실패만 재발송한다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/`에 있다.
- 관련 후보 경로(참고용, 확인 안 됨): `src/retry/`, `src/dedupe/`, `src/dispatch/`, `src/adapters/mail.js`
