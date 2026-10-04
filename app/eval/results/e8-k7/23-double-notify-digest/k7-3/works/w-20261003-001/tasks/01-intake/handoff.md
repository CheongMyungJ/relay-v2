---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "재시도 유지와 실패 발송 재전송을 비목표/제약/완료조건에 명시"
    why: "요청 원문: 재시도 자체를 끄면 안 되고 실패한 발송은 다시 보내야 한다"
    by: human
assumptions:
  - "메일 외에 푸시도 중복 가능성이 있어 두 채널 모두 완료조건에 넣음"
  - "테스트 명령은 package.json의 `npm test` (node --test)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "재현 절차가 요청에 없어 fix에서 재현 방법을 먼저 만들어야 함"
recommended_next: null
knowledge_candidates: []
---
## 요약
중복 알림 버그 수정 intent 초안을 썼다. 재시도는 유지하고 실패한 발송만 재전송하는 것이 핵심 조건이다.
## 다음 task가 알아야 할 것
- 테스트: `npm test` (`node --test`), 테스트는 `test/`에 있음
- 참고용 후보 위치(가설 아님, 확인 안 됨): `src/retry/`(queue, worker, policy), `src/dedupe/`, `src/dispatch/`(dispatcher, delivery-log), `src/digest/`
- 팀 지식 항목 없음
