---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는 방식으로 고친다 (순차화, 재시도, timeout 증가는 쓰지 않음)"
    why: "팀 지식 docs/knowledge/archive-tmp-name-needs-unique-part.md, no-retry-skip-timeout-for-flaky-tests.md, batch-keeps-parallel-concurrency-4.md"
    by: ai
assumptions:
  - "정산팀이 임시 파일 이름 규칙(`.<시각>.tmp`)에 의존하지 않는다고 가정함. 확인하지 못함"
rejected:
  - "runPool 결과 순서 수정: ci/batch.test.js의 원인이며 이번 Work의 비목표"
open_questions: []
intent_deviation: null
risks:
  - "`npm run test:ci`는 ci/batch.test.js 간헐 실패(기준 커밋에서도 발생, 비목표) 때문에 가끔 실패한다. 완료조건 '`npm run test:ci` 통과'는 그 Work가 머지돼야 안정적으로 충족된다"
  - "같은 reportId를 동시에 저장하는 경우는 여전히 막지 않는다"
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서(src/runner/pool.js)"
recommended_next: null
knowledge_candidates:
  - "report-archive.js saveReport의 임시 파일 이름은 reportId를 포함해야 한다. 같은 ms에 동시 저장하면 ENOENT와 다른 고객사 내용이 섞이는 증상이 함께 나온다"
  - "test/archive.test.js의 가짜 시계는 sleep마다 시각이 흘러 임시 파일 이름 충돌이 가려진다. 충돌 재현에는 시각을 고정해야 한다"
---
## 요약
ci/archive.test.js 간헐 실패의 원인은 보관 임시 파일 이름이 ms 시각만이라 병렬 저장이 같은 파일을 쓰는 것이었다. `ENOENT`와 고객사 불일치는 같은 원인이다. 이름에 reportId를 넣어 고쳤고 20회 반복에서 실패가 없다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23`, 커밋 63f2c82. 재현 테스트는 test/archive.test.js 마지막 부근(시각 고정).
- 확인 명령: `for i in $(seq 20); do node --test ci/archive.test.js; done` 실패 0.
- `npm run test:ci`가 가끔 실패하는 것은 ci/batch.test.js(기준 커밋에서도 실패, 비목표) 때문이다.
