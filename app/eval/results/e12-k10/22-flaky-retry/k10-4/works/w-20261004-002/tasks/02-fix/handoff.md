---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣어 고친다"
    why: "원인이 ms 시각만 쓴 이름 충돌이라 이름을 작업마다 다르게 하면 병렬 4를 유지한 채 해결됨"
    by: ai
assumptions:
  - "같은 reportId를 동시에 두 번 저장하는 경우는 다루지 않음"
rejected:
  - "runPool 결과 순서: 이 시험의 증상과 무관, 순서 수정 없이 20회 통과. batch 시험은 비목표"
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 같은 ms에 동시에 저장하면 여전히 겹칠 수 있음"
  - "앞 Work(w-20261004-001)에서 runPool을 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "보고서 임시 파일 이름을 시각(ms)만으로 만들면 동시 저장끼리 겹쳐 ENOENT와 다른 고객사 보관본이 생긴다. 위치: src/store/report-archive.js saveReport"
---
## 요약
`saveReport`의 임시 파일 이름이 밀리초 시각뿐이라 동시 저장이 겹치던 것을 reportId를 넣어 고쳤고, 회귀 시험을 추가했다. archive 시험 20회 연속 통과, npm test와 test:ci 통과.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23-24`
- 회귀 시험: `test/archive.test.js` (시각 고정 + 4개 동시 저장)
- 명령: `npm test`(63 통과), `npm run test:ci`(67 통과), `node --test ci/archive.test.js` 20회 fail 0
