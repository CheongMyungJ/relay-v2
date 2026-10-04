---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "archive.test.js의 간헐 실패(임시 파일 이름 충돌)도 함께 고친다"
    why: "완료조건에 npm run test:ci 통과가 있고, 같은 CI 지연 환경에서 나는 같은 계열의 증상이라 범위 안으로 봄"
    by: ai
assumptions: []
rejected:
  - "시험 쪽 문제: 시험은 올바르고 제품 코드(runPool 순서)가 틀렸음"
open_questions: []
intent_deviation: null
risks:
  - "archive 수정은 임시 파일 이름 형식(.reportId.stamp.tmp)이 바뀜. 같은 reportId를 같은 ms에 동시에 저장하면 여전히 겹칠 수 있음"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 items 순서여야 한다. collectResults가 인덱스로 job과 짝짓는다. 완료 순서로 push하면 지연이 있는 CI에서만 어긋난다 (src/runner/pool.js)"
  - "로컬 npm test는 지연이 0이라 순서/경합 버그를 가린다. 지연 있는 ci/ 시험이 잡는다"
  - "saveReport 임시 파일 이름은 ms stamp만으로는 동시 저장에서 겹친다 (src/store/report-archive.js)"
---
## 요약
간헐 실패의 원인 두 가지를 고쳤다. runPool이 결과를 완료 순서로 모아 report가 다른 job에 붙던 것을 items 순서로 바꿨고, saveReport 임시 파일 이름 충돌을 막았다. 재현 테스트 2개 추가, 수정 뒤 test:ci 30회, batch 20회 통과.
## 다음 task가 알아야 할 것
- `src/runner/pool.js`: `results[start + i]`. `src/store/report-archive.js` saveReport tmp 이름.
- 커밋 2개. 테스트: `npm test`, `npm run test:ci`.
- 시험에 재시도/skip/시간 제한 변경 없음 (ci/ 파일 미수정).
