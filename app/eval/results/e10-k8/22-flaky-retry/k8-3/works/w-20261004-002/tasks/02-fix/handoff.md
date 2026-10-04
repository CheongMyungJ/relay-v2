---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "runPool 결과 순서와 saveReport 임시 파일 이름을 둘 다 고친다"
    why: "관찰된 두 증상(ENOENT, 고객사 불일치)이 각각 이 두 원인이고, 팀 지식 docs/knowledge/runner/pool-result-order.md와 현재 코드에서 확인함"
    by: ai
assumptions:
  - "임시 파일 일련번호는 프로세스 안에서만 유일하면 충분하다 (보관소를 쓰는 프로세스가 하나)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 같은 곳을 고쳤을 수 있음, 머지 대기: src/runner/pool.js, src/store/report-archive.js. 머지 시 충돌 가능"
  - "임시 파일 이름 형식이 `.reportId.stamp.tmp-N.tmp`로 바뀜. 이 이름에 의존하는 곳은 없음(listReports는 '.'로 시작하면 제외)"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 짝짓는다. 로컬 npm test는 지연이 없어 통과하고 ci/ 시험에서만 드러난다"
  - "saveReport 임시 파일 이름은 시각만 쓰면 같은 ms 동시 저장에서 겹친다. reportId와 일련번호를 붙인다. ci/archive.test.js의 ENOENT .tmp 간헐 실패가 이것이다"
---
## 요약
ci/archive.test.js 간헐 실패의 원인 둘을 고쳤다. runPool이 끝난 순서로 결과를 쌓던 것을 입력 순서로, saveReport의 시각뿐인 임시 파일 이름에 reportId와 일련번호를 붙였다. 재현 시험 2개 추가, 병렬 4개 그대로.
## 다음 task가 알아야 할 것
- src/runner/pool.js:12-21, src/store/report-archive.js:23
- 시험: test/pool.test.js, test/store.test.js 끝에 추가
- 결과: npm test 64/64, npm run test:ci 68/68, ci/archive.test.js 20회 중 20회 통과 (수정 전 6회 중 4회 실패)
