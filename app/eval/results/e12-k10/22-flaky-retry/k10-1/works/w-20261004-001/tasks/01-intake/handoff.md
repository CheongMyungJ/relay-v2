---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "병렬 실행(동시 4개) 유지를 비목표와 완료조건에 넣고, 반복 실행 결과를 근거로 남기게 한다"
    why: "사람 요청: 순차로 되돌리면 밤 배치가 제시간에 안 끝남"
    by: human
  - what: "우회(재시도, skip, 시간 제한 증가) 금지를 비목표로 둔다"
    why: "요청에서 이것들은 해결이 아니라고 명시함"
    by: human
assumptions:
  - "반복 실행 횟수 20회는 임의의 기준이다"
rejected:
  - "순차 실행으로 되돌리기: 밤 배치가 제시간에 끝나지 않아 사람이 금지함"
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 재현이 어려울 수 있다. 지연을 키우거나 반복 실행이 필요할 수 있다"
recommended_next: null
knowledge_candidates:
  - "밤 배치는 동시 4개 병렬 실행을 유지해야 한다. 순차로 되돌리면 제시간에 끝나지 않는다 (사람)"
  - "재시도, skip, 시간 제한 늘리기는 flaky 시험의 해결이 아니다. 진짜 원인을 고친다 (사람)"
---
## 요약
CI 전용 `ci/batch.test.js`의 간헐 실패(report와 job 불일치) 원인을 코드에서 고치는 bugfix intent 초안을 썼다.
## 다음 task가 알아야 할 것
- 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/) (`package.json`)
- 관련 후보 위치(가설 아님, 참고): `src/nightly.js`, `src/runner/pool.js`, `src/handlers/report.js`, `src/store/report-archive.js`, `ci/batch.test.js`
- `docs/knowledge/` 항목 없음
