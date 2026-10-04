---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "ci/archive.test.js의 임시 파일 충돌도 이번에 함께 고친다"
    why: "완료조건이 npm run test:ci 전체의 반복 통과이고, 같은 병렬 실행에서 생기는 간헐 실패라 범위 안으로 봤다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "runPool 결과 순서 계약이 바뀌었다(입력 순서). 이 순서를 가정하는 다른 호출처는 없음을 확인했다"
  - "임시 파일 이름 형식이 바뀜. 정산팀이 이름 형식에 기대면 영향이 있을 수 있으나 점으로 시작하고 .tmp로 끝나는 규칙은 유지"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 index로 job과 짝짓는다 (src/runner/pool.js)"
  - "보관소 임시 파일 이름은 ms 시각만으로 만들면 병렬 저장에서 겹친다. 저장마다 고유한 값을 붙인다 (src/store/report-archive.js)"
---
## 요약
간헐 실패의 원인 두 가지를 고쳤다. runPool이 결과를 완료 순서로 쌓던 것을 입력 순서로 바꾸고, 보고서 임시 파일 이름이 겹치던 것을 고유하게 했다. 병렬 4개는 유지했고 시험 우회는 없다.
## 다음 task가 알아야 할 것
- 기준 커밋에서 `npm run test:ci` 6회 중 5회 실패. 수정 뒤 30회 연속 통과, `npm test` 통과
- 원인 1: `src/runner/pool.js` 결과 순서. 원인 2: `src/store/report-archive.js:23` 임시 파일 이름
- 재현 테스트: test/pool.test.js, test/archive.test.js 끝에 추가
- 풀만 고치면 20회 중 11회 실패가 남는다 (archive.test.js)
