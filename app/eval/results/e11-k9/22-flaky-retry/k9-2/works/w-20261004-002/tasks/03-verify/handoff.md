---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 같은 reportId 중복 저장 임시 이름 겹침)은 반영하지 않는다"
    why: "서로 다른 보고서가 섞이는 이번 원인과 무관, 범위 밖"
    by: human
  - what: "runPool 결과 순서 문제(지적 2)를 고치려고 fix 단계로 돌아간다"
    why: "정산팀의 '파일 이름과 다른 고객사 보고서 + 실패한 작업' 사고는 임시 이름 충돌만으로 설명되지 않고, runPool이 완료 순서로 결과를 push해 작업과 어긋나는 경로와 맞음. 병렬은 유지"
    by: human
assumptions:
  - "정산팀 사고가 runPool 때문이라는 것은 코드와 시험 실패 정황이며 운영 기록으로 확인하지 않음"
rejected:
  - "fix에서의 runPool 기각: archive 시험 실패만 보고 판단했고 운영 사고와 대조하지 않았음"
open_questions: []
intent_deviation: null
risks:
  - "runPool 결과 순서 문제가 남아 병렬 배치에서 작업 실패가 섞이면 결과와 고객사가 어긋날 수 있음"
  - "intent 비목표(batch 간헐 실패는 따로 고침)와 겹치므로 fix 단계에서 범위를 intake에서 정할지 확인 필요. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "npm run test:ci가 20회 중 4회 batch 시험으로 실패해 완료조건 2가 실패"
recommended_next:
  node: fix
  reason: "runPool이 결과를 완료 순서로 넣어 작업과 결과가 어긋남(src/runner/pool.js:18). 병렬은 유지한 채 입력 순서 자리에 넣고 onChunk done은 별도 카운터로 세야 함"
knowledge_candidates:
  - "runPool 결과 순서가 어긋나면 실패한 작업이 있을 때 보관본의 고객사가 파일 이름과 달라질 수 있다 (정산팀 보고, docs/knowledge/runner/runpool-result-order.md에 규칙 있음)"
---
## 요약
saveReport 임시 이름 수정은 맞고 archive 시험은 20회 0실패, 새 시험은 수정 전 코드에서 실패함을 확인했다. 다만 test:ci는 4/20 실패(ci/batch.test.js, `expected report-7 to belong to job-7, got job-6`)이고 이는 runPool 완료 순서 push 때문이다. 정산팀의 고객사 뒤바뀜 사고도 이 경로와 맞아 fix로 돌아가 고치기로 했다.
남긴 지식: 없음 (팀 지식 docs/knowledge/runner/runpool-result-order.md, store/report-temp-file-name.md에 이미 있음)
## 다음 task가 알아야 할 것
- `src/runner/pool.js:18`: `results.push(result)` 완료 순서. `results[start + i]`로 바꾸고 `done`은 카운터로. `collectResults`(src/collect/collector.js)는 인덱스 짝짓기.
- 재현: `npm run test:ci` 반복, ci/batch.test.js 4/20 실패.
- 지적 1(사소)은 반영하지 않기로 함.
