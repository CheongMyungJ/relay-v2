---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2(둘 다 사소)를 반영하지 않는다"
    why: "사람이 반영하지 않음을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 청구서·견적은 이 브랜치에서 아직 Math.round이고 머지 시 credit-note.js 충돌 가능"
  - "returnedDiscount는 여전히 Math.round를 쓴다. 회계 규칙이 다르면 CN-0112 금액이 달라질 수 있다"
  - "영세율 반품과 저장값 우선은 자동 테스트가 없고 수동으로만 확인했다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 반영하지 않았다. 완료조건 7개는 모두 통과했다. `npm test` 49개가 통과하고 CN-0112는 vat 1,742, total 19,180이다. 테스트 파일 변경은 재현 테스트 추가뿐이라 약화가 아니다.
남긴 지식: 없음 (이번 Work에서 새로 알게 된 규칙은 앞 Work의 docs/knowledge/invoice/vat-per-line-floor.md가 이미 다루고, 사람이 새로 한 말이 없다)
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js:90-91` `creditTotals`
- 재현 테스트: `test/credit-note.test.js` 마지막 테스트
- 명령: `npm test`
- `src/format/`과 `creditNoteTotals`는 변경 없음
