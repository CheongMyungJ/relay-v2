---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "runPool이 입력 순서로 결과를 돌려주게 고친다 (병렬 유지)"
    why: "collectResults가 인덱스로 짝짓는데 pool은 완료 순서로 push해 어긋남"
    by: ai
  - what: "ci/archive.test.js의 간헐 실패 원인(임시 파일 이름 충돌)도 같이 고친다"
    why: "완료조건 `npm run test:ci` 통과에 필요하고 src/ 원인 수정이라 비목표에 닿지 않음"
    by: ai
assumptions: []
rejected:
  - "보고서 처리기의 상태 공유: 처리기는 지역 변수만 쓰고 reportId를 그대로 돌려줌"
open_questions: []
intent_deviation: null
risks:
  - "archive 임시 파일 수정은 batch 버그와 별개 원인이라 의도의 목표 문구(batch 시험)보다 범위가 조금 넓다"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 작업과 짝짓는다 (src/runner/pool.js, src/collect/collector.js)"
  - "CI 전용 시험(ci/)은 지연 jitter로 완료 순서가 바뀔 때만 실패한다. 로컬 npm test는 지연이 없어 못 잡는다"
---
## 요약
`runPool`이 끝난 순서대로 결과를 모아 `collectResults`가 결과를 엉뚱한 작업에 붙이던 것을 입력 순서 유지로 고쳤다. 같은 test:ci의 `ci/archive.test.js`도 임시 파일 이름 충돌로 간헐 실패해 reportId를 이름에 넣어 고쳤다. 재현 테스트 2개를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`, `src/store/report-archive.js` (`saveReport`).
- 수정 전 실패율: `ci/batch.test.js` 20회 중 9회, `ci/archive.test.js` 20회 중 9회. 수정 뒤 각 30회 연속 통과.
- 새 테스트: `test/pool.test.js`, `test/archive.test.js` 끝.
- 확인: `npm run test:ci` 5회 통과, `npm test` 64 통과.
