---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "같은 `test:ci`에서 드러난 두 번째 결함(임시 파일 이름 충돌)도 함께 고쳤다"
    why: "첫 수정 뒤에도 test:ci가 30번 중 16번 실패했고, 완료조건이 test:ci 반복 통과를 요구함"
    by: ai
assumptions: []
rejected:
  - "재시도, skip, 시간 제한 증가: 비목표이며 원인이 순서 가정과 이름 충돌로 설명됨"
  - "순차 실행으로 되돌리기: 사람이 병렬 4개 유지를 요구함"
open_questions: []
intent_deviation: null
risks:
  - "임시 파일 이름 형식이 `.<reportId>.<stamp>.tmp`로 바뀌었다. 정산팀이 임시 파일 이름에 의존하면 영향이 있다(`listReports`는 `.`로 시작하는 파일을 제외함)"
  - "같은 reportId를 동시에 두 번 저장하는 경우는 보호하지 않음"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 작업과 짝짓는다 (src/runner/pool.js)"
  - "동시에 쓰는 임시 파일 이름은 시각만으로 만들면 같은 ms에 겹친다. 고유 키(reportId)를 넣는다 (src/store/report-archive.js)"
---
## 요약
test:ci 간헐 실패의 원인 두 가지를 고쳤다. runPool이 결과를 완료 순서로 쌓아 보고서가 다른 작업에 붙던 것, saveReport 임시 파일 이름이 같은 ms에 겹치던 것이다. 병렬 4개는 유지했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`, `src/store/report-archive.js:23`
- 재현 테스트: `test/pool.test.js`, `test/archive.test.js` 끝부분
- 확인: `npm test` 64 통과, `npm run test:ci` 50/50 통과 (수정 전 10번 중 7번 실패)
