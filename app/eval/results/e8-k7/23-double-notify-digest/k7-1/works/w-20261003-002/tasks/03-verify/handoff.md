---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 3번(동시 실행 중복)만 반영하고 사소 1, 2번은 반영하지 않는다"
    why: "사람이 사소 지적은 그대로 두고, 요약 일정이 서버 두 대에서 돌아 동시 실행 중복이 실제 경로라며 3번 반영을 요청함"
    by: human
  - what: "발송 전 ledger.claim으로 원자적 선점, 성공은 markSent, 실패는 release로 풀어 재시도 유지. 선점은 10분 뒤 만료"
    why: "동시 실행 2통 실측. 실패 건 재시도는 비목표라 유지. 프로세스가 죽어도 요약이 건너뛰어지지 않게 만료를 둠"
    by: human
assumptions:
  - "운영 ledger가 공유 저장소이고 claim을 SET NX처럼 원자적으로 구현할 수 있다고 가정(이 레포는 메모리 구현)"
rejected:
  - "3번을 위험으로만 기록: 사람이 서버 두 대 동시 실행이 실제 경로라고 알려 줌"
open_questions: []
intent_deviation: null
risks:
  - "어댑터가 시간 초과 오류를 던진 뒤 재시도는 서버가 이미 받았으면 중복될 수 있음(멱등 키 없음)"
  - "서버 간 한 통 보장은 공유 저장소의 원자적 선점이 필요하며 이 레포에서는 검증 못 함"
  - "선점 만료 10분보다 긴 발송, 보낸 키 TTL 3일 뒤 재실행은 다시 보낼 수 있음"
  - "src/retry/policy.js decide()는 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 동시 실행 중복(권장)을 찾아 사람이 고른 3번만 반영했다. 발송 전 키 선점과 실패 시 해제를 넣고 테스트 2건을 더했다. 완료조건 6개 모두 통과했고 `npm test` 80건이 통과한다. 남긴 지식: docs/knowledge/digest-key-excludes-run-id.md, docs/knowledge/digest-scheduler-runs-on-two-servers.md, docs/knowledge/digest-claim-before-send.md
## 다음 task가 알아야 할 것
- 수정 커밋 e9afc8d: `src/digest/ledger.js`(claim/release/claimTtlMs), `src/digest/runner.js`(claim, catch에서 release), 테스트는 `test/digest.test.js` 끝 2건.
- 재현 확인: `node --test test/digest.test.js` 15건, `npm test` 80건.
- 동시 실행 실측: 수정 전 같은 ledger 2통, ledger 따로인 서버 2대 2통(후자는 여전히 2통, 공유 저장소 필요).
