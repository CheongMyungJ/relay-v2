---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 모듈 내 증가 번호를 붙여 충돌을 없앤다"
    why: "원인이 같은 밀리초 저장의 임시 이름 충돌이고, 시각만으로는 유일하지 않다. 재시도나 완화 없이 코드에서 고치라는 규칙(docs/knowledge/testing/flaky-tests-fix-cause.md)을 따름"
    by: ai
assumptions:
  - "운영 저장소도 같은 폴더에서 이름이 겹치면 같은 문제가 생긴다고 가정 (프로세스가 여러 개면 번호도 겹칠 수 있음)"
rejected:
  - "쓰는 도중 앞부분만 보이는 동작: rename이 한 번에 일어나 원인이 아님"
  - "지연/timeout 문제: 충돌은 같은 밀리초면 생기므로 시간과 무관, 덮는 방식은 금지"
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci 전체는 ci/batch.test.js의 별도 간헐 실패(범위 밖)로 아직 가끔 실패한다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "번호는 프로세스 안에서만 유일하다. 여러 프로세스가 같은 폴더에 동시에 저장하면 겹칠 수 있다"
  - "작업 중 git stash를 한 번 썼다가 apply 후 drop했다. 남은 stash 없음"
recommended_next: null
knowledge_candidates:
  - "report-archive의 saveReport 임시 파일 이름이 시각(ms)만으로 정해져 있으면, 동시 저장이 같은 임시 파일을 써서 ENOENT와 고객사 뒤바뀜이 간헐로 난다. 지연이 있는 ci/archive.test.js에서만 보인다"
---
## 요약
`saveReport`의 임시 파일 이름이 밀리초 시각뿐이라 동시 저장이 충돌하던 것을, 호출마다 늘어나는 번호를 붙여 고쳤다. 재현 시험을 `test/archive.test.js`에 추가했고 수정 전 실패, 후 통과를 확인했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js` `saveReport`의 `tmp` 이름과 `tmpSeq`.
- 시험: `npm test`는 통과. `ci/archive.test.js`는 30회 반복에서 실패 0.
- `npm run test:ci`는 `ci/batch.test.js`(결과 순서, 범위 밖)가 가끔 실패한다. 이번 수정과 무관.
