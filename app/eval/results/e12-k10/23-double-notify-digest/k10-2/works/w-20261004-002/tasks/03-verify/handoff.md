---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(동시 실행 예약), 2(digest.slow 단언) 모두 반영"
    why: "사람이 모두 반영을 선택"
    by: human
  - what: "서버 두 대 경로를 위해 보낸 요약 키 저장소를 주입 가능한 공유 저장소 계약으로 바꾸고 reserve를 원자적 연산으로 함"
    why: "사람이 요약 작업이 서버 두 대에서 돈다고 알려 주고 fix 방식(2번)을 선택. 판정 불가로 넘기지 않음"
    by: human
assumptions:
  - "운영 저장소 종류는 사람이 모름. 계약(원자적 reserve, 만료)을 지키는 어댑터를 나중에 주입한다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "운영용 공유 저장소 어댑터가 레포에 없음. digestSentStore를 주입하지 않으면 서버 간 중복 방지 안 됨. 어댑터가 reserve 원자성을 지켜야 함"
  - "서버별 요약함(inbox)이 따로라 서버마다 담긴 알림이 다르면 요약 내용이 다를 수 있음(미확인)"
  - "원장 TTL(3일) 지난 뒤나 원장이 빈 재시작에서는 재발송 가능"
  - "일반 알림 경로 src/retry/policy.js decide()에 같은 원인이 있을 수 있음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건을 반영(97d9bad)한 뒤 사람이 서버 두 대 실행을 알려 줘 공유 저장소 기반 원자적 예약으로 확장(27daf8d)했고 `npm test` 84건 통과. 완료조건 7개 모두 통과(서버 두 대 근거는 메모리 공유 저장소 시뮬레이션), 테스트 파일 약화 없음. 기준 코드에서 재현 4건 실패를 다시 확인했다.
새 지식: docs/knowledge/digest/digest-key-period-user.md — 요약 키 규칙을 다룬 기존 항목이 없음(서버 두 대 공유 저장소 규칙과 미정 항목 포함)
고친 지식: docs/knowledge/dispatch/retry-only-failed-sends.md — 요약 경로 적용과 요약 재발송 필요성 추가(앞 내용 유지)
## 다음 task가 알아야 할 것
- `src/digest/sent-store.js`: 공유 저장소 계약과 메모리 구현. `ledger.js`가 쓰고 `createNotifier({ digestSentStore })`로 주입. `runner.js`가 예약, catch에서 해제.
- 검증 결과는 `verification.md`, PR 초안은 `pr.md`.
