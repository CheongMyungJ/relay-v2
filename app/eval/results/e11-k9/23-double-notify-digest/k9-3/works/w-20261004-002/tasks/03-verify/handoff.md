---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "메일 어댑터 응답 timeout도 중복의 원인으로 보고 요약 runner에서 보낸 것으로 처리한다(재발송 안 함). 진짜 실패(transient 등)는 계속 재시도한다"
    why: "메일 서버 담당자 말: 응답이 늦어도 서버가 받은 메일은 모두 나간다. 사람이 이 경로도 고치라고 요청함"
    by: human
  - what: "ECONNRESET은 timeout에서 빼고 transient 실패로 재시도한다"
    why: "연결이 끊긴 것은 서버가 메일을 받았다고 볼 수 없어 사람이 말한 근거(응답만 늦은 경우)에 해당하지 않음"
    by: ai
  - what: "가짜 메일 전송의 timeout은 메일을 내보내고(sent에 timedOut) 오류를 던지게 한다"
    why: "사람이 요청: 페이크가 timeout에 메일을 보낸 것으로 흉내 내도록"
    by: human
  - what: "리뷰 지적 2(사소, digest.slow 지표 단언)는 반영하지 않는다"
    why: "사람이 반영하지 않아도 된다고 답함"
    by: human
assumptions:
  - "요약 메일의 timeout은 ETIMEDOUT·ESOCKETTIMEDOUT(SendTimeoutError)만을 가리킨다고 봄"
rejected:
  - "timeout을 transient 재시도에서 빼기만 하고 실패로 기록: 서버가 받은 메일을 실패로 기록하면 고객 문의에서 틀리고 재실행에서 다시 보냄"
open_questions: []
intent_deviation: null
risks:
  - "timeout을 보낸 것으로 보는 근거는 메일 서버 담당자의 말이다. 실제 서버가 일부 timeout에서 메일을 받지 못하면 그날 요약이 빠질 수 있음(ledger unconfirmed 기록, digest.unconfirmed 지표로 추적)"
  - "푸시·일반 알림 경로(src/retry/policy.js decide, src/adapters/push.js)는 범위 밖이라 그대로임. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "보낸 키 보관(digest.ledgerTtlMs 기본 3일)이 지난 뒤 같은 기간을 재실행하면 다시 보낼 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
전체 리뷰 뒤, 사람 요청으로 메일 응답 timeout 경로도 고쳤다(runner에서 보낸 것으로 처리, 커밋 1db9490). 완료조건 5개 모두 최종 코드에서 통과했고 `npm test`는 80개 통과다. 사소 지적 1건은 반영하지 않았다. `pr.md`를 썼다.
고친 지식: docs/knowledge/delivery/success-beats-timeout.md — 메일 응답 timeout은 보낸 것으로 보고, ECONNRESET은 재시도하며, 가짜 timeout은 메일을 내보낸다는 사실을 추가함(기존 내용은 모두 유지)
## 다음 task가 알아야 할 것
- 수정: `src/digest/{deadline,key,runner}.js`, `src/adapters/{mail,fake-transports}.js`, 테스트 `test/digest.test.js` 끝 5개
- 경로별 검증과 위험은 `verification.md` 참고
