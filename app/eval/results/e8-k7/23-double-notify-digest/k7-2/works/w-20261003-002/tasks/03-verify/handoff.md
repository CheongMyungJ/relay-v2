---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(서버 두 대 동시 실행에서 확인과 기록이 원자적이지 않음)을 반영한다: 발송 전 키 선점, 실패하면 해제"
    why: "사람이 서버 두 대 동시 실행과 배포일 아침 재실행이 실제 운영 사실이라 범위 안이라고 정함"
    by: human
  - what: "사소 지적 2, 3(slow 지표 단언, 건너뛴 건 기록)은 반영하지 않는다"
    why: "사람이 1번만 반영하기로 함. 동작 문제 아님"
    by: human
assumptions:
  - "운영 공용 ledger가 키 삽입 충돌 방식의 원자적 선점을 지원한다고 보았다(확인하지 못함)"
rejected:
  - "재시도 횟수·설정 변경: 비목표이자 팀 규칙"
open_questions: []
intent_deviation: null
risks:
  - "운영 공용 DB의 원자적 선점 지원 여부 미확인. 메모리 ledger에서만 시험함"
  - "선점한 서버가 발송 중 죽으면 TTL까지 그 요약이 건너뛰어질 수 있음(누락 쪽)"
  - "src/retry/policy.js decide()는 같은 결함이 남아 있음. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "신고된 3~4초 간격 중복은 일반 발송 경로와 맞아 보임. 운영 확인 필요"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 서버 두 대 동시 실행 구멍을 찾아 사람이 고른 대로 고쳤다. 완료조건 6개 모두 통과(`npm test` 83건). 사소 지적 2건은 반영하지 않았다.
남긴 지식: docs/knowledge/digest-runs-on-two-servers.md
## 다음 task가 알아야 할 것
- 커밋 840c95f: `src/digest/ledger.js`의 `claim`/`release`, `runner.js:40` `claim`, catch의 `release`, `notifier.js`의 `digestLedger` 주입.
- 테스트: `test/digest.test.js` 끝의 `twoServers` 시험 4건.
- 되돌리면(claim→has) 서버 두 대 테스트 실패, release 제거 시 재시도·재실행 테스트 5건 실패 확인.
- 재시도 설정(maxAttempts 3, retryDelayMs 60000) 기준과 동일.
