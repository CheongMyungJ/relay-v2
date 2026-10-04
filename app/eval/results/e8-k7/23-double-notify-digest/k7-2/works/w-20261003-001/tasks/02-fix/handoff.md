---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 발송은 걸린 시간과 무관하게 성공으로 본다 (일반 발송과 요약 모두)"
    why: "도착한 메일을 시간 초과로 보고 재시도하는 것이 중복의 원인"
    by: ai
  - what: "요약 키에서 runId를 뺀다"
    why: "runId가 있으면 재실행마다 키가 달라 이미 보낸 요약 확인이 무효. 같은 중복 발송 경로라 범위 안으로 봄"
    by: ai
assumptions:
  - "중계 서버가 제한 시간보다 느리게 응답하는 상황이 운영의 중복 원인이라고 본다 (운영 로그는 확인하지 못함)"
rejected:
  - "dedupe 키 문제: 수신 중복 제거는 정상 동작하며 재시도 경로와 무관"
  - "재시도 정책 변경: 실제 실패는 계속 재시도해야 하므로 건드리지 않음"
open_questions: []
intent_deviation: null
risks:
  - "발송 호출 자체에는 제한 시간이 없어 매우 느린 호출은 끊기지 않음 (이번 범위 밖)"
  - "digestKey에서 runId를 빼서 같은 기간을 의도적으로 다시 보내려면 ledger 키를 지워야 함"
recommended_next: null
knowledge_candidates:
  - "성공한 발송을 느리다는 이유로 실패 취급해 재시도하면 중복 발송이 된다. src/retry/policy.js, src/digest/deadline.js가 해당 위치였다"
  - "재시도 자체를 끄는 것은 중복 발송의 해결이 아니다 (사람)"
---
## 요약
느리게 성공한 발송을 시간 초과로 보고 재시도해 같은 알림이 2~3번 가던 것이 원인이었다. 일반 발송과 요약 메일 모두 고쳤고 요약 재실행 중복도 막았다. 실제 실패는 그대로 재시도한다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js`(성공 우선), `src/digest/deadline.js`(slow 플래그), `src/digest/key.js`(runId 제거), `src/digest/runner.js`
- 재현 테스트: `test/duplicate-send.test.js` (6개). 수정 전 5개 실패
- `npm test`: 80개 통과, 기존 테스트 변경 없음
