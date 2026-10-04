---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "ci/archive.test.js의 임시 파일 충돌 flake도 같이 고친다"
    why: "완료조건이 `npm run test:ci` 통과와 20회 반복 통과이고, 같은 test:ci에서 함께 실패해 따로 두면 조건을 못 채움"
    by: ai
  - what: "runPool은 병렬을 유지한 채 결과를 인덱스 자리에 넣는다"
    why: "순차 실행 복귀는 비목표"
    by: ai
assumptions: []
rejected:
  - "지연/타임아웃 문제: 실패가 job 짝 어긋남이라 시간 제한과 무관"
open_questions: []
intent_deviation: null
risks:
  - "archive 임시 파일 충돌 수정은 intent가 언급한 batch.test.js 밖이다(같은 test:ci 안정화 목적)"
  - "임시 파일 이름 형식이 바뀌었다(.reportId.stamp.tmp). 정산팀이 이름 규칙에 의존하면 확인 필요"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 items 순서여야 한다. collectResults가 인덱스로 짝짓는다 (src/runner/pool.js)"
  - "ms 시각만으로 만든 임시 파일 이름은 동시 저장에서 겹친다. 고유 요소(reportId)를 넣는다"
---
## 요약
간헐 실패의 원인은 두 가지였다. runPool이 결과를 완료 순서로 쌓아 report가 다른 job에 붙었고, 보관 임시 파일 이름이 ms 시각뿐이라 동시 저장이 충돌했다. 둘 다 고치고 재현 테스트를 추가했다. test:ci 20/20 통과.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`(인덱스 자리에 결과), `src/store/report-archive.js`(tmp 이름에 reportId)
- 테스트: `test/pool.test.js`, `test/archive.test.js` 끝에 추가. 수정 전 둘 다 실패 확인.
- 검증: `npm run test:ci` 20회 중 20회 통과, `npm test` 64 통과. 기준 커밋은 8회 중 3회 실패.
