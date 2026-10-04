---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(서버 간 동시 발송 차단)과 2(옛 키 형식 호환)를 반영하고 3·4(사소)는 반영하지 않는다"
    why: "서버 두 대에서 일정이 같이 돌아 inFlight로는 막히지 않고, 키 형식 변경으로 배포일 한 통 더 나갈 수 있다"
    by: human
assumptions:
  - "운영 ledger는 공유 DB이고 claim을 원자적 연산(유일 키 insert)으로 구현할 수 있다고 가정했다. 이 저장소에서는 확인 불가"
  - "선점 TTL 5분은 한 번 발송보다 충분히 길다고 가정"
rejected:
  - "inFlight Set만으로 겹친 실행 방지: 프로세스 안만 막아 서버 둘 동시 발송을 못 막음"
open_questions: []
intent_deviation: null
risks:
  - "운영 공유 DB의 claim 원자 구현이 없으면 서버 간 동시 발송은 막히지 않는다"
  - "진짜 ETIMEDOUT로 결과가 불확실하면 재시도 때 중복 가능성이 남는다(재시도 유지 제약)"
  - "롤링 배포 중 옛 코드 서버와 새 서버가 동시에 도는 구간은 막히지 않는다"
  - "지적 3(inFlight 건너뜀을 already로 셈), 4(느린 성공 경고 로그 테스트 없음) 미반영"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 차단 1건(서버 간 동시 발송), 권장 1건(옛 키 호환)이 나와 사람이 반영을 골랐고, 고쳐서 커밋했다(30b4f05). `npm test` 83 pass. 모든 완료조건 통과.
새 지식: docs/knowledge/digest/retry-stays-enabled.md — 재시도 유지 규칙(사람), 맞는 기존 항목 없음
새 지식: docs/knowledge/digest/digest-dedupe-key.md — 키·claim·옛 키 규칙, 맞는 기존 항목 없음
새 지식: docs/knowledge/digest/slow-send-is-not-timeout.md — 느린 성공을 실패로 보면 3통, 맞는 기존 항목 없음
## 다음 task가 알아야 할 것
- 경로별 "한 번만" 근거(test/digest.test.js): 최초 발송 `중복 방지(최초 발송)`, 재시도 `중복 방지(재시도)` 2건, 스케줄러 재실행 `중복 방지(스케줄러 재실행)`, 겹침 `중복 방지(겹치는 실행)`, 서버 둘 `중복 방지(서버 둘)`, 배포일 `중복 방지(배포일)`, 실패 뒤 전달 `한 실행이 실패해도…`·`보내다 실패하면 선점이 풀려…`.
- 코드: src/digest/ledger.js(claim/release/hasLegacy), runner.js, key.js, deadline.js, src/dedupe/store.js(keys()).
- 재현: `git checkout 6ea77c6 -- src && node --test test/digest.test.js` → 6건 실패(복구는 `git checkout HEAD -- src`).
- 운영 ledger(공유 DB)에는 claim/hasLegacy를 원자적·조건 조회로 구현해야 한다.
