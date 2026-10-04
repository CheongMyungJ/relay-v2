---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "ci/archive.test.js의 간헐 실패(임시 파일 이름 충돌)도 함께 고쳤다"
    why: "완료조건이 npm run test:ci 통과이고, 같은 유형(지연에 따른 경쟁)이며 시험이 아닌 코드의 원인이라 제약에 맞음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 반복 횟수(test:ci 30회, batch 20회) 밖의 실패 가능성은 0이 아님"
  - "임시 파일 이름은 같은 reportId를 같은 밀리초에 동시에 저장하면 여전히 겹칠 수 있음 (현재 호출 경로에는 없음)"
recommended_next: null
knowledge_candidates:
  - "runPool의 결과는 완료 순서가 아니라 items 순서여야 한다. collectResults가 인덱스로 짝짓는다 (src/runner/pool.js)"
  - "저장 임시 파일 이름을 시각만으로 만들면 동시 저장 때 겹친다. 고유 키(reportId)를 넣는다 (src/store/report-archive.js)"
---
## 요약
간헐 실패의 원인은 두 가지였다. runPool이 결과를 완료 순서로 모아 job과 report가 어긋났고, 보고서 임시 파일 이름이 밀리초 시각뿐이라 동시 저장이 겹쳤다. 둘 다 고치고 재현 테스트를 더했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`(인덱스로 저장), `src/store/report-archive.js`(임시 이름에 reportId)
- 재현 테스트: `test/pool.test.js`, `test/archive.test.js` 마지막 시험
- 검증: `npm test` 통과, `npm run test:ci` 30회 연속 통과, `ci/batch.test.js` 20회 통과
- 시험 재시도, skip, 시간 제한 증가는 쓰지 않음
