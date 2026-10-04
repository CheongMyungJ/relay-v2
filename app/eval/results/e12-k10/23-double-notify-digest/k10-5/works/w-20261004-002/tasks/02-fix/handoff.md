---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 키에서 runId를 뺀다"
    why: "완료조건: 같은 기간을 두 번 이상 실행해도 한 통. 팀 지식 docs/knowledge/delivery/digest-key-includes-run-id.md"
    by: ai
  - what: "성공한 발송은 느려도 재시도하지 않고 slow 지표만 올린다"
    why: "실패 시 재시도는 유지. 팀 지식 docs/knowledge/delivery/slow-success-is-not-timeout.md"
    by: ai
assumptions:
  - "운영 중복의 주원인은 느린 메일 성공의 재시도로 보며, 실제 운영 지연 수치는 확인하지 않음"
rejected:
  - "일정(scheduler)의 중복 실행: lastPeriod로 한 프로세스에서는 막힘"
open_questions: []
intent_deviation: null
risks:
  - "원장은 메모리라 프로세스 재시작 후에는 기록이 없어 중복 가능(운영은 공용 DB 전제)"
  - "팀 지식 두 항목은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 deadline.js/key.js 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "요약 키에서 runId를 뺐다. 실행별 집계는 원장 항목의 runId로 한다. 요약 발송은 성공이면 느려도 재시도하지 않는다(slow 지표)"
---
## 요약
요약 중복의 원인 두 가지(느린 성공을 시간 초과로 재시도, 키의 runId)를 고쳤다. 재현 테스트 3개 추가, `npm test` 77개 통과.
## 다음 task가 알아야 할 것
- `src/digest/deadline.js`: throw 제거, `slow` 반환
- `src/digest/key.js`: `digest:기간:사용자`
- `src/digest/runner.js`: `digest.send.slow` 지표
- 테스트: `test/digest.test.js` 끝 3개, 명령 `npm test`
