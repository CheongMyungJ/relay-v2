---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "재현 절차는 요청에 없어, 완료조건에 중복 발송 회귀 테스트 추가를 넣었다"
  - "메일과 푸시 모두 중복 방지 대상으로 보았다 (요청은 메일이 더 잦다고만 함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "중복이 재시도, 중복 제거(dedupe), 다이제스트 중 어디서 생기는지 아직 모른다. 범위가 여러 모듈에 걸칠 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
같은 알림이 2~3번 발송되는 버그의 intent 초안을 썼다. 재시도는 유지하고 실제 실패 발송은 재발송해야 한다는 조건을 비목표와 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`, `test/` 디렉터리)
- 참고용 가설이 아니라 관련 후보 위치만 적는다: `src/retry/`(queue, worker, policy), `src/dedupe/`(deduper, key, store), `src/dispatch/`(dispatcher, delivery-log), `src/adapters/mail.js`, `src/digest/`
- 팀 지식(`docs/knowledge/`) 항목 없음
