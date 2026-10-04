---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "사소 지침 2건(deadline.js 주석, slow 지표 단언)을 모두 반영"
    why: "사람이 '모두 반영'을 선택"
    by: human
  - what: "일반 발송 push의 느린 성공 테스트를 추가"
    why: "사람이 경로(메일, push, 요약)마다 직접 근거를 요구"
    by: human
assumptions:
  - "운영의 중복 원인도 느린 SMTP 응답이라고 보았다. 운영 로그로는 확인하지 못함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "실패한 push의 재시도 전달은 직접 테스트가 없음(재시도 로직은 채널 공통)"
  - "digestKey에 runId가 들어 있어 다른 runId로 같은 기간을 다시 돌리면 원장 중복 방지가 듣지 않음(범위 밖)"
  - "영구 오류도 느리면 재시도됨(중복은 아님)"
  - "클라이언트 타임아웃으로 끊겼지만 서버에서는 성공한 발송은 코드로 알 수 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건뿐이었고 모두 반영했다(커밋 c61903a). 완료조건 5개 모두 통과, `npm test` 80개 통과, 재현 테스트 6개 통과. 사람 요청으로 일반 발송 push 테스트를 추가해 메일·push·요약 경로마다 직접 근거가 있다(커밋 7bbe8f7). 테스트 파일은 신규 test/duplicate-send.test.js뿐이라 약화 없음.
새 지식: docs/knowledge/delivery/slow-success-is-not-timeout.md — 기존 항목이 없고, 성공을 시간 초과보다 먼저 판정해야 한다는 재발 가능한 실패 유형
새 지식: docs/knowledge/delivery/digest-key-includes-run-id.md — 기존 항목이 없고, runId 포함 키로 중복 방지가 새는 위험
## 다음 task가 알아야 할 것
- 수정: `src/retry/policy.js:decide`, `src/digest/deadline.js`, `src/digest/runner.js`
- 테스트: `node --test test/duplicate-send.test.js`, `npm test`
- 남은 위험: `src/digest/key.js` digestKey의 runId
