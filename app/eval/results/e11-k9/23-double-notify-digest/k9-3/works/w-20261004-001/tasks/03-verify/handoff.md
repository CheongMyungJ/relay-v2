---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2(둘 다 사소)를 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다. 수정의 정확성과 무관한 테스트 보강 제안이다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 id 이벤트는 24시간 창 안에서 항상 중복으로 본다 (data는 원래 키에서 빠져 있었다)"
  - "요약 키가 기간과 사용자뿐이라 같은 기간을 일부러 다시 보내려면 ledger 보낸 키(보관 3일)가 지나야 한다"
  - "제한 시간을 넘긴 요약 발송은 막지 못하고 경고 로그만 남긴다"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경 전체를 리뷰했고 차단·권장 지적은 없다. 사소 지적 2건은 사람이 반영하지 않기로 했다. 완료조건 5개 모두 통과(재현 테스트는 기준 소스에서 5개 실패, 현재 `npm test` 82개 통과). 바뀐 테스트 파일은 새 `test/no-double-send.test.js`뿐이라 약화 아님.
새 지식: docs/knowledge/delivery/real-failures-must-be-resent.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없고, 재시도를 끄지 말고 실제 실패는 다시 보낸다는 사람의 규칙
새 지식: docs/knowledge/delivery/success-beats-timeout.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없고, 성공이 timeout보다 앞서며 키에 변하는 값을 넣지 않는다는 조사 결과
## 다음 task가 알아야 할 것
- 검증용 재현: 기준 커밋(be97819) 소스에 `test/no-double-send.test.js`만 얹어 `npm test` → 5개 실패
- 지식 커밋 8fee32b, PR 초안은 `tasks/03-verify/pr.md`
