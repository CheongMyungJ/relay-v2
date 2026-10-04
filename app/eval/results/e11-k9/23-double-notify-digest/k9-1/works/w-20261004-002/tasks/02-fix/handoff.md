---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느린 성공은 성공으로 두고 slow 지표/로그만 남김. 제한 시간 강제 중단(Promise.race)은 하지 않음"
    why: "중단하면 전달 여부를 모른 채 재시도해 중복이 생김. 제약: 실패한 발송은 재시도 유지"
    by: ai
  - what: "digestKey에서 runId 제거"
    why: "실행 사이 중복 방지가 되게 함. 실행별 집계는 ledger entries의 runId로 가능"
    by: ai
assumptions:
  - "운영에서 ledger는 서버 공유 DB이고 키 형식 변경은 배포 직후 기존 키와 호환되지 않음(배포 당일 1회 중복 가능)"
rejected:
  - "재시도 끄기/횟수 줄이기: 제약 위반"
  - "푸시 경로 원인설: 요약은 메일 어댑터만 사용"
open_questions: []
intent_deviation: null
risks:
  - "소켓 시간 초과(ETIMEDOUT) 뒤 실제로는 전달됐던 메일은 전달 여부를 알 수 없어 재시도하며 중복이 남을 수 있음. 멱등 키(메일 헤더 등)가 SMTP 중계에서 쓰이지 않으면 막을 수 없음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기 (retry/policy.js 쪽은 이번에 손대지 않음)"
  - "ledger 보낸 키 TTL(3일)이 지나면 같은 기간 재실행이 다시 보낼 수 있음"
recommended_next: null
knowledge_candidates:
  - "요약 발송 경로는 메일뿐이다(src/digest/runner.js가 adapters.mail 사용). 푸시는 즉시 알림 전용"
  - "요약 중복 방지 키(src/digest/key.js)에 실행 ID를 넣으면 실행 사이 중복 방지가 깨진다. 키는 기간+사용자만"
  - "src/digest/deadline.js withDeadline은 성공을 오류로 바꾸지 않는다. 느린 성공을 재시도하면 중복 발송"
---
## 요약
요약 메일 중복의 원인 두 가지를 고쳤다. 느린 성공이 시간 초과로 재시도되던 것, 발송 키에 실행 ID가 들어 실행 간 중복 방지가 안 되던 것. 테스트 4개 추가, `npm test` 78개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js`; 테스트: `test/digest.test.js` 끝 4개.
- 요약 경로는 메일 하나. 경로별 근거는 fix.md 재현 테스트 절.
- 남은 위험: ETIMEDOUT 뒤 실제 전달된 경우 중복(멱등 키 필요), 배포 시 키 형식 변경.
