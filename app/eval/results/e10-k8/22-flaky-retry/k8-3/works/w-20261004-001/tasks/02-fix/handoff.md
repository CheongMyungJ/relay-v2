---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "ci/archive.test.js의 임시 파일 이름 충돌도 함께 고친다"
    why: "같은 test:ci에 포함되고 기준 커밋에서도 실패(20회 중 9회)하며, 완료조건 `npm run test:ci` 통과에 필요하다. 제품 코드 결함이고 비목표에 걸리지 않는다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "임시 파일 이름이 `.reportId.stamp.tmp`로 바뀌었다. 같은 reportId를 같은 ms에 두 번 저장하면 여전히 겹친다"
  - "수정 중 실수로 작업 트리를 되돌렸다가 같은 수정을 다시 적용했다. 최종 diff는 확인함"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 작업과 짝짓는다"
  - "test:ci에는 batch.test.js 말고 archive.test.js의 간헐 실패(임시 파일 이름 충돌)도 있었다"
---
## 요약
runPool이 끝난 순서로 결과를 모아 기록이 다른 작업에 붙던 것을 입력 순서 자리에 넣게 고쳤다. 같은 test:ci의 보관소 임시 파일 이름 충돌도 고쳤다. 병렬 4개는 유지했다.
## 다음 task가 알아야 할 것
- `src/runner/pool.js`: `results[start + i]`
- `src/store/report-archive.js` saveReport: 임시 파일 이름에 reportId 추가
- 재현 테스트: test/pool.test.js, test/archive.test.js 마지막 테스트
- 결과: `npm test` 64 통과, `test:ci` 20/20, `ci/batch.test.js` 20/20
- 기준 커밋 `test:ci`는 10회 중 8회 실패
