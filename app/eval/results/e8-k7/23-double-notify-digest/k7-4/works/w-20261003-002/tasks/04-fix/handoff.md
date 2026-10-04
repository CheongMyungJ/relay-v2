---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 키에서 runId를 빼고 기간+사용자로 고정, 요약 메일에 고정 Message-ID 헤더를 붙인다"
    why: "사람 추가 지시(기간+사용자 고정 멱등 키/Message-ID, 재시도 유지)"
    by: ai
  - what: "성공한 발송은 경과 시간과 무관하게 성공으로 처리"
    why: "docs/knowledge/successful-send-is-never-timeout.md"
    by: ai
assumptions:
  - "운영 메일 중계 서버가 같은 Message-ID를 한 번만 내보낸다고 가정(가짜 transport로만 확인)"
  - "서버 두 대가 동시에 같은 요약을 보내는 경우의 방어는 Message-ID 중복 제거에 의존"
rejected:
  - "재시도를 끄거나 timeout을 영구 오류로 취급: 제약과 사람 지시에 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "실제 메일 서버가 Message-ID 중복 제거를 안 하면 timeout-후-이미 나감 케이스는 중복 가능. 서버 두 대 동시 실행은 ledger가 서버별이라 막지 못하며 공유 DB의 선점(claim)이 있어야 완전하다"
  - "일반 알림 경로 src/retry/policy.js decide()도 같은 원인(성공+경과>timeout→retry)이다. 비목표라 고치지 않음. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "fake-transports.js 변경(테스트 지원 코드)"
recommended_next: null
knowledge_candidates:
  - "요약 발송 키는 기간+사용자로만 정한다. runId를 넣으면 재실행·서버별로 키가 달라 중복 발송된다(src/digest/key.js)"
  - "메일 서버는 응답이 늦어도 받은 메일은 보낸다. timeout 후 재시도는 고정 Message-ID(기간+사용자)로 같은 메일임을 알려 중복을 막는다. 재시도를 끄면 안 된다 (사람)"
---
## 요약
성공을 timeout으로 보던 것, 키의 runId, 재시도 시 동일 메일 식별 부재를 고쳤다. 실제 실패는 그대로 재시도된다. 경로별 테스트 6개 추가, `npm test` 80개 통과.
## 다음 task가 알아야 할 것
- 변경: src/digest/{deadline,key,message,runner}.js, src/adapters/fake-transports.js
- 테스트: test/digest-duplicate.test.js (기준 코드에서 5/6 실패)
- 한계: Message-ID 중복 제거는 중계 서버 몫, 서버 간 동시 발송은 공유 선점 없음
- src/retry/policy.js decide()는 손대지 않음
