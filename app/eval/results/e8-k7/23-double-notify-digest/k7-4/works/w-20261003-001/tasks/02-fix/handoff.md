---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 발송은 경과 시간과 무관하게 완료로 본다. 디지털 요약 withDeadline도 같은 방식으로 고친다"
    why: "같은 원인(성공 후 시간 초과 판정)이 일반 발송과 요약 메일 두 곳에 있고, 원하는 결과가 메일·푸시 모두 한 번 전달"
    by: ai
assumptions: []
rejected:
  - "dedupe 결함: 수신 중복 제거는 정상이고 중복은 발송 단계 재시도에서 생김"
  - "요약 ledger 키(runId 포함): 같은 run에서는 has()가 막고, 문제는 성공 뒤 예외로 markSent가 안 된 것"
open_questions: []
intent_deviation: null
risks:
  - "실패한 발송이 제한 시간을 넘기면 영구 오류여도 timeout으로 재시도되는 기존 동작은 그대로 둠(범위 밖)"
  - "응답이 영영 오지 않는 transport를 끊는 실제 타임아웃은 없음(기존에도 없음)"
  - "서로 다른 run(runId)의 요약은 ledger 키가 달라 별도 중복 방지가 안 됨. 이번 재현 경로는 아님"
recommended_next: null
knowledge_candidates:
  - "성공한 발송을 경과 시간 때문에 실패로 보면 재시도로 중복 알림이 생긴다. 위치: src/retry/policy.js decide(), src/digest/deadline.js withDeadline()"
---
## 요약
성공한 발송이 제한 시간(일반 2000ms, 요약 3000ms)을 넘기면 실패로 보고 다시 보내 중복이 생기던 것을 고쳤다. 메일이 느려서 더 자주 겪었다. 실패한 발송의 재시도는 그대로다. `npm test` 80개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js:13-14`, `src/digest/deadline.js`. 커밋 하나.
- 재현 테스트: `test/retry.test.js`, `test/notifier.test.js`, `test/digest.test.js` 끝에 추가. 수정 전 3개 실패.
- 재시도 유지 테스트: timeout 오류 실패, 제한 시간 넘긴 실패는 retry.
- 기존 테스트 변경 없음.
