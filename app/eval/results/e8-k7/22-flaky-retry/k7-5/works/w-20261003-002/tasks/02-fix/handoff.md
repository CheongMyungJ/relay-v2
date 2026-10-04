---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "고객사 불일치 원인인 runPool 완료 순서 버그도 함께 고친다"
    why: "요청의 로그에 고객사 불일치가 함께 나오고 docs/knowledge/runpool-preserve-input-order.md 규칙이 같은 수정을 요구함. 병렬도는 그대로"
    by: ai
assumptions:
  - "ci/batch.test.js의 간헐 실패는 pool 순서 문제와 겹칠 수 있으나, 앞 Work 몫이라 따로 확인하지 않음"
rejected:
  - "병렬도 축소나 순차 실행: 비목표이자 팀 규칙(keep-batch-parallelism)"
  - "재시도, timeout 증가: 팀 규칙(no-flaky-workarounds)"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 순서(src/runner/pool.js)와 임시 파일 이름. 머지 시 충돌 가능"
  - "test/archive.test.js의 새 시험은 수정 전에도 통과해 회귀 방지 효과가 약함"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름은 reportId를 포함해야 한다. stamp(ms)만 쓰면 같은 ms 동시 저장이 겹쳐 ci/archive.test.js가 ENOENT로 간헐 실패한다"
  - "test/ 시험은 sleep을 가짜로 바꿔 동시성 문제가 드러나지 않는다. 동시성 버그는 ci/ 시험을 20회 이상 반복해 확인한다"
---
## 요약
ci/archive.test.js 간헐 실패의 원인 두 가지를 고쳤다. 임시 파일 이름 충돌(ENOENT)과 runPool 완료 순서 결과(고객사 불일치). 병렬도는 그대로이고 test:ci 20회가 모두 통과했다.
## 다음 task가 알아야 할 것
- 수정: src/store/report-archive.js(saveReport tmp 이름), src/runner/pool.js(results[start + i])
- 수정 전 ci/archive.test.js 20회 중 9회 실패, 수정 후 test:ci 20회 0회 실패
- 시험: test/pool.test.js 순서 시험 추가(수정 전 실패), test/archive.test.js 동시 저장 시험 추가
