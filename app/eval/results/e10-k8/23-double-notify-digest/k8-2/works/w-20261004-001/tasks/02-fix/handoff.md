---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "성공한 발송은 느려도 성공으로 본다 (decide, withDeadline)"
    why: "이미 전달된 알림을 시간 초과로 재시도하면 중복된다. 실제 실패(오류 발생)는 그대로 재시도"
    by: ai
  - what: "요약 발송 기록 키에서 runId를 뺀다"
    why: "같은 기간을 재실행해도 이미 보낸 요약은 다시 보내지 않아야 한다(원하는 결과). 실행별 집계는 entries의 runId 사용"
    by: ai
assumptions:
  - "실제 SMTP 중계가 느려지는 경우가 운영의 주된 원인이라고 가정(운영 로그는 못 봄)"
rejected:
  - "dedupe 키 문제: 수신 단계는 정상, 재시도 경로에서 중복"
  - "워커가 job을 두 번 꺼냄: takeDue가 shift로 꺼냄"
open_questions: []
intent_deviation: null
risks:
  - "발송이 제한 시간을 넘겨 성공해도 이제 실패로 안 보므로 timeout 지표/재시도로는 느린 발송이 드러나지 않음(send.<채널>.ms 지표는 유지)"
  - "transport가 실제로 응답 없이 멈추면(promise가 안 끝남) 여전히 제한 시간 장치가 없다. 기존에도 없었음"
recommended_next: null
knowledge_candidates:
  - "발송이 느리게 성공한 것을 시간 초과 실패로 보고 재시도하면 중복 발송된다. 성공은 걸린 시간과 무관하게 성공이다 (src/retry/policy.js, src/digest/deadline.js)"
  - "요약 발송 기록 키(digestKey)에는 runId를 넣지 않는다. 같은 기간 재실행이 중복 발송되지 않게 하려는 것"
---
## 요약
느리게 성공한 발송을 시간 초과로 판정해 재시도하던 것이 중복의 원인이다. 즉시 발송(메일, 푸시)과 요약 메일 모두 고쳤고, 요약 재실행 중복도 막았다. 재시도는 그대로이며 실제 실패만 재시도한다.
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js` decide, `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js`
- 테스트: `test/no-double-send.test.js` 8개. `npm test` 82개 통과(기준 74개). 기존 테스트 변경 없음.
- 수정 전 `src/`로 되돌리면 새 테스트 5개 실패 확인함.
