---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "archive 임시 파일 이름 충돌도 함께 고쳤다"
    why: "같은 증상 계열(보고서와 작업 불일치)이고 test:ci 통과 조건에 필요했다"
    by: ai
assumptions: []
rejected:
  - "재시도/타임아웃 문제: 로그에 재시도 없음"
open_questions: []
intent_deviation: null
risks:
  - "runPool 반환 순서가 입력 순서로 바뀜: 완료 순서에 의존하던 코드가 있으면 영향"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다: collectResults가 인덱스로 job과 짝짓는다 (src/runner/pool.js)"
  - "같은 폴더에 동시에 쓰는 임시 파일 이름은 ms 시각만으로 만들면 겹친다 (src/store/report-archive.js)"
---
## 요약
간헐 실패의 원인 두 가지를 고쳤다. runPool이 결과를 끝난 순서로 모아 report가 다른 job에 붙던 것, 보고서 임시 파일 이름이 같은 ms에 겹치던 것.
## 다음 task가 알아야 할 것
- `src/runner/pool.js`: `results[start + i]`로 입력 순서 유지
- `src/store/report-archive.js`: 임시 이름에 reportId 포함
- 검증: `npm run test:ci` 30회 연속 통과, `npm test` 64 통과
