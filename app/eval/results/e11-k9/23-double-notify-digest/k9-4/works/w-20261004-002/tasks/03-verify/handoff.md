---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장(1번)만 반영하고 사소한 2·3번은 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 고름. 2번은 코드로 막을 수 없어 남은 위험으로 기록"
    by: human
  - what: "최종 실패한 요약은 다음 tick에서 기간당 3번까지 다시 돌린다"
    why: "intent 목표: 못 보낸 요약은 다시 보낸다. 영구 오류가 매 tick 반복되지 않게 횟수 제한"
    by: ai
assumptions:
  - "기간당 재실행 3번은 임의 값이며 설정으로 빼지 않음"
rejected:
  - "옛 키(runId 포함)까지 확인해 배포 직후 중복 막기: 옛 키는 runId를 알아야 만들 수 있어 불가"
open_questions: []
intent_deviation: null
risks:
  - "배포 직전 옛 키로 보낸 요약은 배포 직후 같은 기간 재실행 시 중복될 수 있음"
  - "서버 둘이 동시에 같은 기간을 돌리면 둘 다 보낼 수 있음(공유 DB 원자적 확인은 범위 밖)"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/retry/policy.js"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건 중 사람이 고른 1건(실패한 요약을 스케줄러가 다시 돌리지 않음)을 반영해 커밋했다(125800a). 완료조건 6건 모두 통과, `npm test` 83건 통과. 기준 코드에서는 새 테스트 7건이 실패한다.
새 지식: docs/knowledge/delivery/digest-key-without-run-id.md — 발송 키 규칙을 다루는 기존 항목이 없음
새 지식: docs/knowledge/delivery/digest-rerun-failed.md — 스케줄러 재실행 규칙을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 반영 코드: `src/digest/scheduler.js`의 `MAX_RUNS_PER_PERIOD`(3)
- 테스트: `node --test test/digest.test.js`(18건), 전체 `npm test`(83건)
- 팀 지식 `success-before-timeout.md`는 digest 쪽도 이미 다루어 고치지 않음
