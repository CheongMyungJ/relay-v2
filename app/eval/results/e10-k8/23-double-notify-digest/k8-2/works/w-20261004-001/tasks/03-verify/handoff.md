---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2번 모두 반영"
    why: "사람이 모두 반영을 고름"
    by: human
assumptions:
  - "실제 SMTP 중계가 느려지는 경우가 운영의 주된 원인이라고 가정(운영 로그는 못 봄)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "digest.sendTimeoutMs 설정이 쓰이지 않는 죽은 설정으로 남음"
  - "느린 발송은 지표로만 드러남. 응답 없이 멈추는 transport는 제한 시간 장치가 없음(기존에도 없었음)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건을 모두 반영했다(`withDeadline`을 `withTiming`으로 정리, 테스트 2개 추가). 완료조건 6개 모두 통과, `npm test` 84개 통과. 바뀐 테스트 파일은 새 파일 하나이며 약화 아님.
새 지식: docs/knowledge/notify/retry-keeps-real-failures.md — 맞는 기존 항목이 없는 까닭: 항목이 없었음
새 지식: docs/knowledge/notify/slow-success-is-success.md — 맞는 기존 항목이 없는 까닭: 항목이 없었음
## 다음 task가 알아야 할 것
- `src/digest/timing.js` withTiming(옛 deadline.js), `src/retry/policy.js` decide, `src/digest/key.js`
- 테스트: `test/no-double-send.test.js` 10개. 명령 `npm test`
- 커밋: d52ec7e(리뷰 반영)와 지식 커밋
