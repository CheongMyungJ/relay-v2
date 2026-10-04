---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(권장)만 반영하고 2(사소)는 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions: []
rejected:
  - "ledger.has 제거: 사소한 정리이고 사람이 반영 대상으로 고르지 않음"
open_questions: []
intent_deviation: null
risks:
  - "claim은 프로세스 메모리 기준이라 서버 간 동시 실행은 막지 못함(운영 DB ledger의 원자적 claim 필요)"
  - "어댑터가 시간 초과 오류를 던졌지만 서버가 접수한 경우의 중복은 다루지 않음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/retry/policy.js, src/digest/deadline.js (머지 시 충돌 가능)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 claim 뒤 메시지 생성이 실패하면 release가 안 되어 요약이 하루 누락되는 문제(권장)를 찾아 반영했다(커밋 8ab7fec, 테스트 추가). 완료조건 6개 모두 통과, `npm test` 84건 통과. 기준 코드에서는 새 테스트 7건이 실패한다. 테스트 파일은 추가만 있어 약화 아님.
새 지식: docs/knowledge/digest/digest-key-and-claim.md — 요약 키·claim을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/digest/runner.js`: itemsFor·메시지 생성이 try 안에 있다. claim 뒤 어떤 실패든 catch의 release를 탄다.
- 검증 명령: `npm test` (84건).
- `pr.md`, `verification.md`는 task 디렉터리에 있다.
