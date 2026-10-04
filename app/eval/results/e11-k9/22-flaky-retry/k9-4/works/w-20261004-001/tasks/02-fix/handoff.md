---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "runPool이 입력 순서대로 결과를 돌려주게 고친다 (collector는 그대로)"
    why: "runPool의 문서/사용처(collectResults)가 입력 순서를 전제하고, 병렬 4개와 시험은 건드리지 않아도 됨"
    by: "ai"
assumptions: []
rejected:
  - "시험 재시도/skip/시간 제한 증가: 비목표, 원인이 코드의 순서 버그임"
  - "순차 실행으로 되돌리기: 사람이 병렬 유지를 요구함"
open_questions: []
intent_deviation: null
risks:
  - "runPool을 쓰는 다른 곳이 완료 순서에 의존하면 달라질 수 있으나 src 안에서 collectResults 외 사용은 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 작업과 짝짓는다 (src/runner/pool.js, src/collect/collector.js)"
---
## 요약
runPool이 끝나는 순서로 결과를 쌓아 지연이 다르면 report가 이웃 job에 붙던 버그를 입력 순서 저장으로 고쳤다. 병렬 4개 유지. 순서 테스트를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js` (results[start + i]), 테스트: `test/pool.test.js` 마지막 케이스
- 재현: `node --test ci/batch.test.js` 반복(수정 전 6회 중 3회 실패)
- 검증: npm test 63 pass, test:ci 10회 / batch 20회 모두 통과
