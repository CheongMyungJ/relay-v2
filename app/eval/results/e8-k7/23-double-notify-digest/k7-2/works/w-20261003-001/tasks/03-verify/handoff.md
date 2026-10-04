---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 옛 digest 키 기록)을 반영하지 않는다"
    why: "ledger 보관 3일로 영향이 짧고 추천을 따름"
    by: human
assumptions:
  - "운영의 발송 제한 시간 설정 변경과 3~4초 간격은 코드로만 설명했고 운영 로그와는 대조하지 못했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "배포 전 옛 키로 남은 요약 기록은 배포 직후 재실행 시 한 번 중복될 수 있음"
  - "운영의 실제 제한 시간 값은 미확인. fix.md의 '느릴 때만 생긴다'는 기본값 기준 추정"
  - "발송 호출 자체에는 제한 시간이 없음 (이번 범위 밖)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 사람이 반영하지 않기로 했다. 여섯 완료조건 모두 통과: 재현 테스트 6개 통과(기준 커밋 소스에서는 5개 실패), `npm test` 80개 통과, 기존 테스트 변경 없음. `pr.md`를 썼다.
남긴 지식: docs/knowledge/no-disable-retry-for-duplicates.md, docs/knowledge/slow-success-is-not-failure.md, docs/knowledge/timeout-setting-change-before-duplicates.md
## 다음 task가 알아야 할 것
- 수정 위치: `src/retry/policy.js`, `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js`
- 재현 테스트: `node --test test/duplicate-send.test.js`
- 사람이 지난주 발송 제한 시간 설정 변경과 3~4초 간격을 언급했다. 운영의 `NOTIFY_SEND_TIMEOUT_MS`, `NOTIFY_DIGEST_SEND_TIMEOUT_MS` 값 확인 필요
