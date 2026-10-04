---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는 방식으로 고친다"
    why: "팀 지식 docs/knowledge/store/report-temp-file-name.md: 이름에 보고서마다 다른 값을 넣고 접두 . 와 접미 .tmp는 유지. 병렬 실행과 LATENCY는 건드리지 않음(docs/knowledge/testing/flaky-tests-fix-the-cause.md)"
    by: ai
assumptions:
  - "reportId는 동시에 저장되는 보고서끼리 서로 다르다. 같은 reportId를 동시에 저장하는 경우는 다루지 않음"
rejected:
  - "runPool 결과 순서: 이 시험의 증상과 무관하고 수정 뒤 통과. batch.test.js 범위"
open_questions: []
intent_deviation: null
risks:
  - "runPool이 끝난 순서로 결과를 모으는 문제는 src/runner/pool.js에 그대로 있음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "같은 reportId를 같은 ms에 동시에 저장하면 여전히 임시 이름이 겹침"
recommended_next: null
knowledge_candidates: []
---
## 요약
임시 파일 이름이 시각뿐이라 같은 ms에 시작한 동시 저장이 같은 임시 파일을 쓰던 것이 원인이다. 이름에 reportId를 넣어 고쳤고, 재현 시험을 추가했다. test:ci 67개 통과, archive 시험 30회 연속 통과.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23`
- 재현 시험: `test/archive.test.js` 마지막 시험(시각 고정 + 동시 4개 저장). 수정 전 ENOENT로 실패.
- 수정 전 `ci/archive.test.js` 20회 중 11회 실패, 수정 후 30회 0회.
- 병렬 실행, LATENCY, 기존 시험은 변경 없음.
