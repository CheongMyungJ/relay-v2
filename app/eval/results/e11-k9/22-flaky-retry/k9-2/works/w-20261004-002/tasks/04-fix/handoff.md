---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "runPool 결과를 results[start + i]에 넣고 done은 별도 카운터로 센다"
    why: "사람 지시와 팀 지식 docs/knowledge/runner/runpool-result-order.md"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "intent의 비목표(batch 시험)가 사람 지시로 이번 범위에 들어옴. 사람이 명시적으로 허용함"
  - "runPool은 묶음 단위로 기다리므로 느린 작업 하나가 같은 묶음을 붙잡음(기존 동작, 유지)"
recommended_next: null
knowledge_candidates:
  - "batch 시험 실패(고객사 뒤바뀜)의 원인은 runPool 완료 순서 push이며, 이번에 입력 순서 자리에 넣고 done 카운터를 분리해 고침. test:ci 20회 0실패"
---
## 요약
runPool이 결과를 입력 순서 자리에 넣도록 고치고 onChunk done은 별도 카운터로 셌다. 결정적 시험을 추가했고 test:ci 20회 모두 통과했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js` runPool, 시험: `test/pool.test.js` 끝의 2개
- `npm test` 65 통과, `npm run test:ci` 20회 0실패 (수정 전 10회 중 3회 실패)
