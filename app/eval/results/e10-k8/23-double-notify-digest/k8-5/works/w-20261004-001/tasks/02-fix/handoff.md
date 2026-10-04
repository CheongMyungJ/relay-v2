---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느린 성공도 성공으로 보고, 디스패치와 요약 두 경로를 함께 고쳤다"
    why: "원인이 같은 패턴(성공 후 시간 초과 판정)이고 둘 다 같은 증상(중복 발송)이라 범위 확장이 아님"
    by: ai
  - what: "느린 성공은 slow 지표로 남긴다"
    why: "시간 초과 감시 정보는 유지하되 재시도 판단에서는 뺌"
    by: ai
assumptions:
  - "실제 시간 초과는 어댑터가 던지는 오류(ETIMEDOUT 등)로 드러나므로 성공 응답을 시간만으로 실패 처리할 필요가 없다"
rejected:
  - "수신 중복 제거(src/dedupe) 결함: 증상이 같은 이벤트의 재발송이라 발송 재시도 쪽에서 설명됨"
  - "재시도 워커 이중 실행: takeDue가 job을 제거하고 busy 플래그가 막음"
open_questions: []
intent_deviation: null
risks:
  - "요약 키(src/digest/key.js)에 runId가 들어가고 기본 runId에 시각이 있어, 같은 기간을 다시 run하거나 재시작으로 scheduler의 lastPeriod가 사라지면 요약이 또 나갈 수 있음(이번 수정 범위 밖, 확인만 함)"
  - "발송이 제한 시간보다 훨씬 늦게 성공해도 이제 재시도하지 않으므로 응답을 받지 못한 채 실제로는 실패한 경우는 어댑터 오류에 의존함"
recommended_next: null
knowledge_candidates:
  - "성공한 발송은 걸린 시간과 관계없이 성공이다. 시간 초과 판정은 실패 응답에만 쓴다 (src/retry/policy.js, src/digest/deadline.js)"
---
## 요약
느리게 성공한 발송(메일 2초, 요약 3초 초과)을 시간 초과 실패로 보고 다시 보내던 것이 중복의 원인이었다. 성공은 시간과 무관하게 완료로 처리하게 고쳤고, 실제 실패 재시도는 그대로다. 테스트 79건 통과.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js` decide, `src/digest/deadline.js` withDeadline(`slow` 반환), 지표 `*.slow`
- 재현 테스트: `test/duplicate-send.test.js` (5건), 명령 `npm test`
- 커밋 6a11905. 기존 테스트 변경 없음
- 미해결 가능성: 요약 키에 runId 포함(`src/digest/key.js`) — 재실행 시 중복 소지
