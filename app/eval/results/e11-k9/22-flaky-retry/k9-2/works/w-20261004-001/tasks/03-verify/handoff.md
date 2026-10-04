---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "차단 지적(보고서 임시 파일 이름 충돌)만 반영하고 사소한 지적은 반영하지 않음"
    why: "사람이 '차단·권장만 반영'을 고름"
    by: human
assumptions: []
rejected:
  - "test/pool-order.test.js의 sleep 의존: 순서가 우연히 맞을 가능성이 낮아 사소로 두고 반영하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "임시 이름 충돌 수정에는 전용 재현 시험이 없고 ci/archive.test.js가 확률적으로 잡음"
  - "같은 reportId를 같은 ms에 두 번 저장하면 임시 이름이 겹침"
  - "runPool 외부 사용처는 확인하지 못함"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 fix 단계가 놓친 두 번째 원인을 찾았다. 보고서 임시 파일 이름이 ms 단위라 같은 ms 저장끼리 겹쳐 ci/archive.test.js가 간헐 실패했다. 사람이 고른 이 지적을 반영해 커밋했고, 모든 완료조건이 통과했다.
새 지식: docs/knowledge/testing/flaky-tests-need-root-cause.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목 없음 (사람이 알려 준 규칙)
새 지식: docs/knowledge/runner/runpool-result-order.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목 없음
새 지식: docs/knowledge/store/report-temp-file-name.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목 없음
## 다음 task가 알아야 할 것
- 반영 커밋 44e2193: `src/store/report-archive.js:23~24`
- 최종 코드: `npm test` 63, `npm run test:ci` 67 통과, test:ci와 ci/batch.test.js 각 30회 반복 실패 0
- fix.md의 "test:ci 67 통과"는 이 임시 이름 충돌 때문에 우연히 통과한 결과였다
- 바뀐 테스트 파일: test/pool-order.test.js(추가, 약화 아님)
