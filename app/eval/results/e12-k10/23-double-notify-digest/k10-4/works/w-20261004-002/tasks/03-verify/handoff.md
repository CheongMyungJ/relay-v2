---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "발송 전 원자적 선점(claim) 방식으로 ledger를 바꾸고, 공유 저장소는 digestClaims 주입으로 받는다"
    why: "사람 요청: 서버 두 대·재시작 뒤에도 한 번만 가게. 레포에 공유 저장소가 없어 인터페이스와 메모리 구현을 만듦"
    by: human
  - what: "리뷰 지적 중 차단·권장(1번)만 반영하고 사소한 2, 3번은 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions:
  - "예외로 끝나는 기간도 digest.maxAttempts회까지만 재시도하는 것이 맞다고 보았다"
rejected:
  - "지적 2(시작 기간 계산 가독성), 3(timeoutMs 죽은 인자): 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "선점 저장소 기본 구현은 메모리다. 운영 공유 저장소를 digestClaims로 주입하기 전에는 서버 두 대·배포 날 중복이 남는다"
  - "보낸 직후 확정 전에 서버가 죽으면 claimTtlMs(10분) 뒤 재발송될 수 있다"
  - "ETIMEDOUT처럼 전달 여부를 모르는 어댑터 오류는 계속 재시도되어 드물게 중복될 수 있다"
  - "앞 Work(w-20261004-001)에서 retry/ 쪽을 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건 중 권장 1건(예외 기간의 재시도 상한과 기간별 격리)을 반영해 커밋했다(d45faf8). 완료조건 6개 모두 통과, `npm test` 80개 통과. 바뀐 테스트 파일은 새로 추가한 `test/digest-duplicate.test.js`뿐이고 약화는 없다.
새 지식: docs/knowledge/digest/digest-key-excludes-run-id.md — 요약 발송 키 규칙을 다루는 기존 항목이 없음
새 지식: docs/knowledge/digest/scheduler-pending-periods.md — 요약 스케줄러의 기간 관리 함정을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 테스트: `npm test`(85개), 재현 `node --test test/digest-duplicate.test.js`(6개), 서버 두 대 `test/digest-claims.test.js`(5개)
- 선점: `src/digest/claims.js`, 주입 `createNotifier({ digestClaims })`, 설정 `digest.claimTtlMs`
- 반영 위치: `src/digest/scheduler.js` 기간별 try/catch와 포기 처리
- PR 초안: tasks/03-verify/pr.md
