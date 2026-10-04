---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(권장, 동시 실행 중복)만 반영하고 2(사소, TTL 3일)는 반영하지 않음"
    why: "사람이 '차단·권장만 반영'을 고름"
    by: human
assumptions:
  - "운영의 발송 기록은 공유 DB라 프로세스 재시작과 서버 간에도 키로 중복이 막힌다고 가정(여기선 메모리)"
rejected:
  - "지적 2(ledger TTL 문서화 외 변경): 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "inFlight와 ledger는 메모리라 서버 간 동시 실행은 막지 못함"
  - "보낸 키는 ledgerTtlMs 3일 뒤 만료되어 더 오래된 기간 재실행은 재발송될 수 있음"
  - "앞 Work(w-20261004-001)에서 src/retry/policy.js 느린 성공 재시도를 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(동시 실행 중복)을 반영해 커밋(6e85104)했고 `npm test` 79 통과. 완료조건 6개 모두 통과, 테스트 약화 없음.
고친 지식: docs/knowledge/retry/digest-key-includes-run-id.md — runId 제거로 고쳐졌음, inFlight 막기와 3일 TTL 한계를 추가
## 다음 task가 알아야 할 것
- `src/digest/runner.js` `inFlight`: 동시 실행 중복 방지. 테스트는 `test/digest.test.js` 마지막 건.
- 기준 코드로 `git checkout 7d7867c -- src` 하면 새 테스트 4건이 실패하고, `git checkout HEAD -- src`로 복구한다.
- 산출물: tasks/03-verify/verification.md, pr.md
