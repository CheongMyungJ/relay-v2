---
schema_version: 1
work_id: w-20260925-001
task_id: t-04
node: rca
skill: root-cause
status: awaiting_approval
intent_version: 1
artifacts: [rca.md]
decisions:
  - what: "원인은 토큰 만료 시각 비교의 타임존 불일치"
    why: "재현 테스트 실패 값의 차이가 정확히 9시간(UTC/KST)"
    by: human
    requires_human: true
assumptions:
  - "서버 TZ는 운영 환경에서도 Asia/Seoul이다 (확인 안 됨)"
rejected:
  - "캐시 TTL 가설: 캐시를 끄고도 재현 테스트가 같은 값으로 실패"
open_questions: []
intent_deviation: null
risks:
  - "같은 비교 함수를 쓰는 refresh 경로도 영향 가능"
self_checks:
  - { name: repro, result: fail, note: "고정된 재현 테스트는 여전히 실패 (수정 전이므로 정상)" }
recommended_next: null
knowledge_candidates:
  - statement: "auth 모듈의 시각 비교는 모두 UTC epoch로 해야 한다"
    scope: project
    evidence: "rca.md 3절"
---
## 요약
만료 판정이 `Date` 로컬 시각 문자열 비교로 되어 있어 KST 환경에서 9시간 일찍 만료된다.

## 다음 task가 알아야 할 것
- 수정 지점: `src/auth/token.ts` `isExpired()` 한 곳. refresh 경로(`refresh.ts:42`)도 같은 함수를 쓴다.
- 재현 테스트 `tests/auth/expiry.test.ts`는 고정되어 있다. 수정하지 말 것.
