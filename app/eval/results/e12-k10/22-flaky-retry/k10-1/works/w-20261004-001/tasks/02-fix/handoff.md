---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣어 충돌을 없앤다 (archive 간헐 실패도 함께 고침)"
    why: "같은 test:ci 통과 조건에 걸리고 같은 증상(다른 보고서가 섞임)이라 범위 안으로 봄"
    by: ai
assumptions: []
rejected:
  - "순차 실행으로 되돌리기: 사람이 금지함, 원인도 아님"
  - "재시도/skip/시간 제한 증가: 비목표"
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 같은 ms에 동시에 저장하면 여전히 임시 이름이 겹친다 (현재 배치에서는 reportId가 작업마다 유일)"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 items 순서를 보장해야 한다. collectResults가 인덱스로 job과 짝짓는다"
  - "임시 파일 이름은 ms 시각만으로 만들면 동시 저장끼리 겹친다 (src/store/report-archive.js)"
---
## 요약
간헐 실패 원인 두 가지를 고쳤다. runPool이 완료 순서로 결과를 쌓던 것을 입력 순서로 두고, 보고서 임시 파일 이름에 reportId를 넣었다. 동시 4개 유지.
## 다음 task가 알아야 할 것
- `src/runner/pool.js` 결과 인덱스 저장, `src/store/report-archive.js` tmp 이름
- 반복 실행: `ci/batch.test.js` 20/20 통과, `npm run test:ci` 30/30 통과, `npm test` 64 통과 (수정 전 test:ci 10회 중 6회 실패)
- 기본 동시 실행 수는 `src/config.js`의 4 그대로
