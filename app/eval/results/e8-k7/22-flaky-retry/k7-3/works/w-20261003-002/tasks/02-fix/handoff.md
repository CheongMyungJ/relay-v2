---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "동시성은 그대로 두고 임시 파일 이름에 reportId를 넣어 고친다"
    why: "docs/knowledge/keep-parallel-concurrency.md, no-retry-skip-for-flaky-tests.md 규칙, 원인을 src/에서 고침"
    by: ai
assumptions:
  - "runPool 완료 순서 결과 수집은 batch.test.js 쪽 문제(비목표)라 고치지 않음"
rejected:
  - "runPool 결과 순서가 archive 실패의 원인: 보관본 내용은 순서와 무관하게 payload에서 옴"
open_questions: []
intent_deviation: null
risks:
  - "src/runner/pool.js는 여전히 완료 순서로 결과를 모음. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름은 reportId를 포함해야 한다. ms 시각뿐이면 같은 ms의 동시 저장이 충돌해 ENOENT와 내용 뒤바뀜이 난다 (src/store/report-archive.js)"
  - "시각을 setNow로 고정하면 동시 저장 충돌을 지연 없이 로컬 npm test에서 재현할 수 있다 (test/archive.test.js)"
---
## 요약
saveReport 임시 파일 이름에 reportId를 넣어 동시 저장 충돌(ENOENT, 보관본 뒤바뀜)을 고쳤다. 동시 저장 재현 시험을 추가했고 수정 전 실패, 수정 후 통과를 확인했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js` saveReport의 tmp 이름 `.<reportId>.<stamp>.tmp`.
- 시험: `test/archive.test.js` 마지막 시험(시각 고정).
- 결과: `npm run test:ci` 67 통과, `npm test` 63 통과, `ci/archive.test.js` 30회 반복 실패 0.
- 이 브랜치의 `pool.js`는 아직 완료 순서로 결과를 모음(비목표).
