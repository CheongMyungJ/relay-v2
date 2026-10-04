---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "일반 알림 발송, 요약 내용·템플릿·발송 시각 정책, 과거 중복 메일 회수는 비목표로 둔다"
    why: "요청은 요약 메일의 중복 발송과 누락 방지만 다룬다"
    by: ai
assumptions:
  - "중복 발송 재현 테스트가 아직 없다고 보고 추가 항목을 완료조건에 넣었다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 재시도 중복 관련 수정을 했을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그의 intent 초안을 썼다. 중복 방지와 미발송 요약 재발송·무누락을 완료조건으로 했다. 코드는 건드리지 않았다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 요약 관련 코드: `src/digest/` (`runner.js`, `scheduler.js`, `ledger.js`, `key.js`, `deadline.js`), 재시도: `src/retry/`
- 참고(원인 근거 아님): `docs/knowledge/retry/slow-success-is-not-timeout.md` (기준 브랜치에는 아직 없음, 앞 Work w-20261004-001)
