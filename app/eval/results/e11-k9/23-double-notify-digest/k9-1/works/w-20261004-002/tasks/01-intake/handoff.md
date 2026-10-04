---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도를 끄거나 줄이는 방식으로 풀지 않는다를 제약에 넣음"
    why: "팀 지식 keep-retry-for-real-failures 규칙 (요청의 '못 보낸 요약은 다시 보내야 함'과도 일치)"
    by: ai
assumptions:
  - "요약 발송 경로가 여러 개(메일, 푸시 등)라고 보고 경로별 근거를 완료조건으로 둠 (코드에서 경로 수는 확인하지 않음)"
  - "일반 알림 발송은 범위 밖으로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261004-001)에서 왔고 머지 대기 중. 같은 문제를 앞 Work에서 이미 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그의 의도 초안을 썼다. 목표는 하루 한 번 수신, 실패한 발송은 재시도, 하루 건너뛰기 금지, 경로별 근거 제시이다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/` 아래.
- 요약 관련 코드: `src/digest/` (deadline, key, ledger, runner, scheduler 등), 재시도: `src/retry/`.
- 참고 팀 지식(참고만, 원인 근거 아님): `docs/knowledge/retry/slow-success-is-not-failure.md` (앞 Work 브랜치, 이 브랜치에는 없음).
- 원인은 아직 조사하지 않았다. fix에서 확인할 것.
