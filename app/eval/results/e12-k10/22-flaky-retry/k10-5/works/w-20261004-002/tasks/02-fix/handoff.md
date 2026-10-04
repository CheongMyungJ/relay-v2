---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "saveReport 임시 파일 이름에 reportId와 호출별 번호를 넣는다"
    why: "시각(ms)만으로는 같은 ms 동시 저장이 겹침. 팀 지식 docs/knowledge/runner/pool-result-order.md의 규칙과 같은 방향"
    by: ai
  - what: "runPool 결과 순서는 고치지 않는다"
    why: "ci/batch.test.js 원인이며 사람이 범위에서 뺌"
    by: ai
assumptions: []
rejected:
  - "runPool 결과 순서가 archive 실패의 원인: 보관본 내용에 영향이 없고 batch.test.js 실패의 원인임"
open_questions: []
intent_deviation: null
risks:
  - "`npm run test:ci`는 ci/batch.test.js 간헐 실패(runPool 순서) 때문에 아직 가끔 실패한다. 범위 밖이며 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "임시 파일 번호는 프로세스 안 카운터라 여러 프로세스가 같은 보관소에 쓰면 겹칠 수 있다(이름에 reportId와 시각이 있어 같은 보고서를 같은 ms에 저장할 때만)"
recommended_next: null
knowledge_candidates:
  - "saveReport(src/store/report-archive.js)의 임시 파일 이름은 시각(ms)만으로 정하면 동시 저장이 겹쳐 ENOENT나 다른 고객사 내용 보관이 난다. reportId와 호출별 번호를 넣는다"
  - "간헐 실패하는 시험은 재시도, skip, 시간 제한 증가가 아니라 제품 코드의 근본 원인을 고친다 (사람)"
  - "정하지 않음: ci/batch.test.js의 간헐 실패 — 별도 Work에서 리뷰 중, 이번 범위에서 뺌 (사람)"
---
## 요약
ci/archive.test.js 간헐 실패의 원인은 saveReport 임시 파일 이름 겹침이었다. 이름에 reportId와 호출별 번호를 넣어 고쳤고 재현 테스트를 추가했다. 커밋 343ba02.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23-26`, 재현 테스트: `test/archive.test.js` 마지막 테스트(수정 전 실패 확인).
- `npm test` 63 통과. `npm run test:ci` 25회 중 archive 시험은 전부 통과, batch 시험(`보고서마다 제 작업과 고객사가 붙는다`)은 10회 실패 — 기준 커밋에서도 실패, 범위 밖.
- 재현 테스트는 실제 sleep과 고정 시각, 이름 바꾸기 지연(baseMs 20)으로 겹침을 만든다.
