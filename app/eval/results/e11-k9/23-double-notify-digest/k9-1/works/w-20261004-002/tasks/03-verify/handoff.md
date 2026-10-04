---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(주석 정리)과 3번(발송 전 키 선점, 실패 시 해제)을 반영, 2번은 반영하지 않음"
    why: "사람이 처음엔 '차단·권장만 반영'을 골랐고, 이어서 3번도 반영해 달라고 요청함"
    by: human
  - what: "선점에 별도 TTL(claimTtlMs 기본 10분)을 둠"
    why: "실행이 죽어 선점이 안 풀려도 하루가 건너뛰어지지 않게 함"
    by: ai
assumptions:
  - "경로별 근거: 요약은 메일 경로 하나뿐이라 푸시는 코드 확인으로 갈음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "ETIMEDOUT 뒤 실제 전달된 메일은 재시도되어 중복 가능(멱등 키 필요)"
  - "키 형식 변경으로 배포 당일 1회 중복 가능"
  - "선점은 메모리 ledger로만 검증함. 운영 공유 DB ledger는 claim을 원자적으로(유일 제약 등) 구현해야 서버 간에도 막힘"
  - "발송이 선점 TTL(10분)보다 오래 걸리면 다른 실행이 다시 보낼 수 있음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기 (src/retry/policy.js decide()의 시간 검사 순서)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건 중 1·3번을 반영했다(3번: 발송 전 키 선점, 실패 시 해제, 동시 실행 테스트 3개). 완료조건 6개 모두 통과, `npm test` 81 통과. 바뀐 테스트 파일은 추가만 있어 약화 아님.
고친 지식: docs/knowledge/retry/slow-success-is-not-failure.md — 요약 경로(withDeadline slow 표시) 추가, 앞 Work 내용은 보존
새 지식: docs/knowledge/digest/digest-key-excludes-run-id.md — 요약 키·선점 규칙을 다루는 기존 항목 없음
새 지식: docs/knowledge/digest/digest-sends-by-mail-only.md — 요약 경로와 중복 위험 사실을 다루는 기존 항목 없음
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `key.js`, `runner.js`, `ledger.js`(claim/release); 테스트 `test/digest.test.js` 끝 7개.
- 수정 전 digest 3파일에 현재 테스트를 돌리면 2개 실패(76/2)로 재현된다.
- 요약 경로는 메일 하나(`src/notifier.js:74`).
