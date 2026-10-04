---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId와 증가 번호를 넣어 유일하게 함"
    why: "원인이 시각 기반 이름 충돌이라 제품 코드(saveReport)에서 고침. 재시도/skip/병렬 변경 없음 (docs/knowledge/flaky-test-policy.md)"
    by: ai
assumptions:
  - "ci/batch.test.js의 간헐 실패는 기준 커밋에서도 있었다고 봄 (runPool 순서 문제, 기준 커밋에서 직접 돌려 확인하지는 않음)"
rejected:
  - "runPool 결과 순서: archive 증상과 무관, batch 쪽 문제"
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci 전체는 ci/batch.test.js의 runPool 순서 문제로 여전히 가끔 실패함. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "완료조건 `npm run test:ci가 통과한다`는 앞 Work 머지 전에는 간헐적으로 못 지킬 수 있음"
recommended_next: null
knowledge_candidates:
  - "saveReport의 임시 파일 이름은 저장마다 유일해야 한다. 시각(ms)만 쓰면 병렬 저장이 같은 파일을 공유해 ENOENT나 고객사 뒤바뀜이 난다 (src/store/report-archive.js)"
---
## 요약
ci/archive.test.js의 간헐 실패 원인은 saveReport 임시 파일 이름의 ms 충돌이었다. reportId와 증가 번호를 넣어 고쳤고, 재현 시험을 추가했다. 단독 25회 반복에서 수정 전 10회 실패, 후 0회.
## 다음 task가 알아야 할 것
- 수정: src/store/report-archive.js saveReport. 시험: test/archive.test.js 마지막 시험.
- 확인: `for i in $(seq 25); do node --test ci/archive.test.js | grep "^# fail"; done | sort | uniq -c`
- npm run test:ci의 남은 가끔 실패는 ci/batch.test.js (runPool 순서), 이번 범위 밖.
