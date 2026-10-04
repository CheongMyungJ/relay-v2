---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름을 reportId와 호출마다 늘어나는 번호로 고유하게 하고, runPool 결과를 입력 순서로 저장"
    why: "팀 지식 docs/knowledge/batch/parallel-ordering-and-temp-names.md의 사실을 현재 코드에서 확인한 뒤 따름. 병렬 4개 유지와 재시도 금지 규칙(flaky-test-policy.md)도 지킴"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 원인(runPool 순서, 임시 파일 이름)은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 src/runner/pool.js와 src/store/report-archive.js에서 충돌 가능"
  - "tempSeq는 프로세스 내 카운터라 여러 프로세스가 같은 보관소에 동시에 쓰면 reportId와 시각이 같을 때 겹칠 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
`ci/archive.test.js` 간헐 실패는 두 원인이었다: 임시 파일 이름 충돌(ENOENT)과 `runPool`의 완료 순서 결과(고객사 불일치). 둘 다 고쳤고 재현 테스트 2개를 추가했다. 병렬 4개와 기존 테스트는 그대로다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`(results[start+i]), `src/store/report-archive.js:23`(임시 이름에 reportId, 시각, 순번).
- 재현 테스트: `test/pool.test.js`, `test/archive.test.js` 마지막 테스트. 수정 전 `npm test` fail 2, 수정 후 0.
- `npm run test:ci` 15회 연속 통과(수정 전 6회 중 5회 실패).
