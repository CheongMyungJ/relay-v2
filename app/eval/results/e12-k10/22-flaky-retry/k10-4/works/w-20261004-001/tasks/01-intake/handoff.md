---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "시험 우회(재시도, skip, 시간 제한 증가)를 비목표와 제약에 넣는다"
    why: "요청이 해결이 아니라고 명시했다"
    by: human
  - what: "병렬 실행(동시 4개) 유지를 비목표와 제약에 넣고, 반복 실행 결과를 완료조건에 넣는다"
    why: "사람이 추가 요청"
    by: human
assumptions:
  - "원인은 제품 코드의 지연 순서 의존으로 보고 intent에 쓰지 않았다. fix에서 확인한다"
  - "회귀 시험 추가를 완료조건에 넣었다"
  - "반복 횟수 20회는 사람이 횟수를 정하지 않아 내가 정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "실패가 가끔만 나므로 재현에 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "배치 병렬 실행(동시 4개)은 유지해야 하며 순차로 되돌리는 것은 해결이 아니다 (사람)"
  - "시험에 재시도, skip, 시간 제한 늘리기는 flaky 시험의 해결이 아니다 (사람)"
---
## 요약
간헐 실패하는 `ci/batch.test.js`의 원인을 제품 동작 문제로 보고 intent 초안을 썼다. 시험 우회는 비목표로 했다.
## 다음 task가 알아야 할 것
- 실패 시험: `ci/batch.test.js` 두 번째 test(보고서 소유 작업 확인). 지연 `LATENCY = { baseMs: 10, perRowMs: 0.25, jitterMs: 5 }`
- 명령: `npm run test:ci` (`node --test "test/**/*.test.js" "ci/**/*.test.js"`), 로컬 `npm test`는 ci/ 제외
- 참고용 가설(확인 안 됨): 결과를 jobId가 아니라 완료 순서나 인덱스로 짝짓는 곳이 의심됨. 볼 곳: `src/runner/runner.js`, `src/runner/pool.js`, `src/nightly.js`(`reportsById`), `src/sources/memory-source.js`, `src/util/jitter.js`
- 병렬 동시 4개는 유지(사람). 완료 근거로 `ci/batch.test.js` 반복 실행 결과 필요
- `docs/knowledge/` 항목 없음
