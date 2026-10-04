---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는다"
    why: "팀 지식 docs/knowledge/store/report-temp-file-name.md의 사실을 코드에서 확인했고 같은 이름 충돌이 원인이다"
    by: ai
  - what: "재현 시험은 기존 파일을 건드리지 않고 새 파일 test/archive-concurrent.test.js로 추가한다"
    why: "완료조건: test/ 아래 기존 시험 변경 금지"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 같은 밀리초에 동시에 저장하면 여전히 겹칠 수 있다. 지금 호출 경로에는 없다"
  - "앞 Work(w-20261004-001)에서 같은 코드를 고쳤을 수 있음, 머지 대기. 머지 때 src/store/report-archive.js가 겹칠 수 있다"
  - "ci/batch.test.js는 비목표라 확인하거나 고치지 않았다"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름에는 reportId와 시각을 함께 쓴다. 시각만 쓰면 같은 밀리초의 동시 저장이 같은 임시 파일을 공유해 ENOENT나 다른 고객사 보관본이 된다 (src/store/report-archive.js)"
---
## 요약
`saveReport`의 임시 파일 이름이 시각만 써서 동시 저장이 겹치던 것을, reportId를 붙여 고쳤다. ci/archive.test.js 25회 연속 통과, test:ci 67개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:24` 임시 이름 `.<reportId>-<stamp>.tmp`
- 재현 시험: `test/archive-concurrent.test.js` (시계 고정 + 동시 저장, 수정 전 ENOENT로 실패)
- 수정 전 `node --test ci/archive.test.js` 10회 중 6회 실패
- 시험 파일의 기존 기대값, 재시도, skip, 시간 제한은 바꾸지 않았다
