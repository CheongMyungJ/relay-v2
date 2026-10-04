---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "일반 알림과 함께 일일 요약 메일(digest)의 같은 패턴도 이번에 고친다"
    why: "같은 원인(성공한 발송을 시간 초과로 보고 재발송)이고 메일 중복이다. 사람이 '둘 다 고침'을 선택"
    by: human
  - what: "성공이면 소요 시간과 상관없이 done으로 하고, 실패일 때만 timeout 사유를 쓴다"
    why: "실제로 실패한 발송은 그대로 재시도해야 한다는 제약"
    by: ai
assumptions:
  - "가짜 transport의 지연으로 느린 중계 서버를 흉내 냈으며 실제 운영 지연 분포는 확인하지 못함"
rejected:
  - "dedupe 저장소/키 문제: 재시도 경로는 이벤트 dedupe를 거치지 않고, 원인은 성공을 retry로 판정한 것"
  - "withDeadline에서 느린 실패를 timeout으로 바꾸기: 영구 오류가 재시도되는 동작 변화가 생겨 하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "withDeadline 반환값에 slow가 추가됨(기존 호출자는 value, elapsedMs만 사용). 느린 성공을 지표로 남기지는 않음"
  - "푸시는 같은 policy.js를 쓰므로 함께 고쳐지지만 푸시 전용 테스트는 추가하지 않음"
recommended_next: null
knowledge_candidates:
  - "발송이 성공했으면 제한 시간(send.timeoutMs, digest.sendTimeoutMs)을 넘겼어도 재시도하지 않는다. 시간 초과는 실패한 발송에만 적용한다: src/retry/policy.js, src/digest/deadline.js"
---
## 요약
성공한 발송이 제한 시간(2초)을 넘었다는 이유로 timeout 재시도되어 같은 알림이 두 번 가던 버그를 고쳤다. 메일은 지연이 길어 더 자주 걸렸다. 일반 알림과 요약 메일 모두 수정했다.
## 다음 task가 알아야 할 것
- 원인: `src/retry/policy.js` `decide()`의 timeout 검사가 성공 검사보다 앞이었음, `src/digest/deadline.js`도 같은 패턴
- 테스트: `npm test` 77 pass. 새 테스트 3건(notifier 2, digest 1). 수정 전 중복 재현 2건 실패 확인
- 실제 실패(transient)는 그대로 재시도됨을 확인하는 테스트 포함
