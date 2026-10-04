---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "archive CI 시험 실패도 같은 test:ci 완료조건 안이라 함께 원인(임시 파일 이름 충돌)을 고쳤다"
    why: "완료조건 `npm run test:ci`가 통과해야 하고, 시험이 아니라 코드를 고치라는 제약"
    by: ai
assumptions:
  - "정산팀 등 외부가 임시 파일 이름 형식(.<stamp>.tmp)에 의존하지 않는다고 가정했다 (.tmp 접미사와 선행 점은 유지)"
rejected:
  - "시간 제한/재시도 문제: 실패가 타임아웃이 아닌 짝 불일치"
open_questions: []
intent_deviation: null
risks:
  - "test:ci는 40번 반복에서 모두 통과했지만 확률적 시험이라 완전 증명은 아님"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 job과 짝짓는다"
  - "보관소 임시 파일 이름은 동시 저장끼리 겹치지 않아야 한다. 시각 꼬리표만으로는 같은 ms에 충돌한다 (src/store/report-archive.js)"
---
## 요약
간헐 실패의 원인 둘을 고쳤다: runPool이 끝난 순서로 결과를 담던 것을 입력 순서로, 임시 파일 이름 충돌을 reportId 포함으로. 병렬 4개는 유지. test:ci 40/40 통과.
## 다음 task가 알아야 할 것
- `src/runner/pool.js`: results[start+i]에 저장
- `src/store/report-archive.js:23`: tmp 이름에 reportId 추가
- 재현 테스트: test/pool.test.js, test/archive.test.js 끝부분
- 검증: `npm test` 64/64, `npm run test:ci` 40번 중 40번 통과
