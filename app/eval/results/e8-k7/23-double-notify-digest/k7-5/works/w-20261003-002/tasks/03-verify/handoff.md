---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "서버 간 동시 경합·분할은 코드를 더 건드리지 않고 남은 위험으로 적고 후속 Work로 넘김"
    why: "공유 저장소가 이 저장소에 없어 선점 수정을 검증할 수 없고 설계(만료·해제)가 운영 저장소에 달려 있음. 사람이 선택"
    by: human
  - what: "리뷰 지적 1(tick 겹침 중복)·2(포기 사용자 누락)·4(가독성)·5(재시작 테스트 보강) 반영, 3(서버 간 동시 경합)은 반영하지 않고 남은 위험으로 기록"
    why: "사람이 1·2·4·5 반영을 골랐다. 3은 공유 저장소 원자적 claim이 필요해 이 저장소로 검증 불가"
    by: human
assumptions:
  - "failed가 있는 기간은 tick마다 다시 돌려도 된다고 봤다(보낸 사용자는 키로 건너뜀, inbox keepDays 안에서만)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "서버 간 중복·분할 위험: ledger(src/digest/ledger.js)와 inbox(src/digest/inbox.js)가 서버별 프로세스 메모리라 이 코드 그대로는 서버 두 대가 각자 보내거나 알림이 나뉠 수 있음. 공유 DB여도 has→send→markSent 사이 선점 없음. 운영 ledger가 무엇인지는 사람이 따로 확인하기로 함"
  - "후속 Work 필요: 공유 저장소 원자적 claim(만료·해제 설계 포함)과 inbox 공유 여부"
  - "키 형식 변경 직후 옛 키(runId 포함) 발송분은 인식되지 않아 한 번 더 갈 수 있고, 배포 중 신·구 서버가 섞이면 더 그럴 수 있음"
  - "영구 오류 사용자도 inbox keepDays 안에서는 tick마다 재시도됨(상한 없음)"
  - "decide()(src/retry/policy.js)의 느린 성공 재시도는 일반 알림 쪽이라 미수정, 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 5건 중 차단 2건(tick 겹침 중복 회귀, 실패 포기 사용자 자동 재발송 안 됨)과 권장 2건을 반영하고 커밋했다. `npm test` 82개 통과, 완료조건 6개 모두 통과. 서버 두 대 동시 경합은 반영하지 않고 남은 위험으로 적었다.
남긴 지식: docs/knowledge/digest-scheduler-marks-done-only-on-clean-run.md, docs/knowledge/digest-scheduler-runs-on-two-servers.md
## 다음 task가 알아야 할 것
- `src/digest/scheduler.js`: `done`(실패 0인 기간)과 `inFlight`(진행 중 기간)
- 테스트: `test/digest.test.js` 끝 8개, 명령 `npm test`(82개)
- 기준 src(`git checkout fb59933 -- src`)에서 추가 테스트 6개 실패 확인
- 커밋: 94c4b41(코드·테스트), 그 뒤 지식 문서 커밋
