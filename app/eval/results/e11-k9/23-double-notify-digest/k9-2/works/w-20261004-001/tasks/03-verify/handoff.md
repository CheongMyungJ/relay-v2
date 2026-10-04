---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(미사용 timeoutMs 인자·주석), 2(영구 오류의 timeout 재시도)를 반영하지 않는다"
    why: "둘 다 사소하고 동작에 영향이 없으며 범위를 지킴"
    by: human
assumptions:
  - "운영의 제한 시간 설정 변경이 원인이라는 것은 로그 없이 코드 근거로만 판단함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "어댑터가 소켓 timeout 오류를 던졌지만 서버는 이미 발송한 경우는 재시도되어 중복될 수 있음 (멱등 키 등 별도 설계 필요)"
  - "withDeadline의 timeoutMs 인자 미사용, 실패+시간초과 영구 오류도 timeout 재시도 (미반영 지적 1, 2)"
  - "digest ledger 키에 runId가 있어 run 사이 중복 방지는 안 됨"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(모두 사소)은 사람이 반영하지 않기로 했다. 5개 완료조건 모두 통과: 재현 테스트가 수정 전 3개 실패, 수정 후 통과했고 `npm test` 78개 통과. 테스트 파일 변경은 신규 파일뿐이라 약화 아님. 사람의 질문(설정 변경과의 일치, 경로별 근거)에 답했고 소켓 timeout 후 이미 발송된 경우의 한계를 남은 위험에 적었다.
새 지식: docs/knowledge/retry/keep-retry-for-real-failures.md — 맞는 기존 항목이 없는 까닭: 지식 항목이 아직 없음 (사람이 알려 준 재시도 유지 규칙)
새 지식: docs/knowledge/retry/success-is-success-regardless-of-time.md — 맞는 기존 항목이 없는 까닭: 지식 항목이 아직 없음 (성공 후 시간 초과 재시도가 중복을 만드는 유형)
## 다음 task가 알아야 할 것
- 검증 산출물: tasks/03-verify/verification.md, pr.md
- 수정 위치: `src/retry/policy.js` decide, `src/digest/deadline.js` withDeadline
- 기준 커밋 src로 되돌려 `node --test test/duplicate-send.test.js` → fail 3 확인 후 복원함
