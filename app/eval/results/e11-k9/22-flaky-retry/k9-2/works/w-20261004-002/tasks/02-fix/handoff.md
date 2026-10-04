---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는다 (시각 꼬리표는 유지)"
    why: "팀 지식 docs/knowledge/store/report-temp-file-name.md의 권고와 현재 코드의 원인이 일치함을 직접 확인"
    by: ai
  - what: "시험을 바꾸지 않고 코드만 고치며, 재현 시험은 새로 추가만 한다"
    why: "팀 지식 docs/knowledge/testing/flaky-tests-need-root-cause.md"
    by: ai
assumptions:
  - "test:ci에 남은 ci/batch.test.js 실패는 기준 커밋에서도 있던 것으로 봄 (기준 커밋에서 따로 확인하지 않음)"
rejected:
  - "runPool 결과 순서: archive 실패와 무관, batch 쪽 비목표"
open_questions: []
intent_deviation: null
risks:
  - "완료조건 'npm run test:ci 통과'는 ci/batch.test.js의 간헐 실패(비목표, 별도 리뷰 중) 때문에 20회 중 8회 미충족"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: saveReport 임시 파일 이름, runPool 결과 순서. 머지 시 report-archive.js 충돌 가능"
  - "작업 중 실수로 git checkout으로 변경을 한 번 되돌렸다가 다시 적용함. 최종 커밋은 정상"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름이 시각(ms)뿐이면 동시 저장 시 겹쳐 ENOENT와 고객사 뒤섞임이 난다. reportId를 넣는다 (src/store/report-archive.js)"
  - "멈춘 시계(setSleep 즉시 반환)로 동시 저장을 만들면 경합을 결정적으로 재현할 수 있다 (test/archive.test.js)"
---
## 요약
saveReport의 임시 파일 이름이 ms 단위 시각뿐이라 동시 저장이 겹치던 것을 reportId를 넣어 고쳤다. 결정적 재현 시험을 추가했고, test:ci 20회에서 archive 시험은 한 번도 실패하지 않았다. batch 시험 실패는 남아 있다(비목표).
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:25`. 시험: `test/archive.test.js` 새 시험(수정 전 실패 확인).
- `npm run test:ci` 20회: 8회 실패, 전부 ci/batch.test.js '보고서마다 제 작업과 고객사가 붙는다' (runPool 결과 순서 의심).
- 기준 커밋에서 batch 실패 여부는 직접 확인하지 않았다.
