---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소) 가운데 2번(README 규칙 한 줄)만 반영하고 1번(음수 줄 floor)은 반영하지 않는다"
    why: "사람이 2번만 반영을 선택함"
    by: human
assumptions: []
rejected:
  - "음수 공급가액 줄 처리 변경: 규정이 없어 회계팀 확인 없이 정할 수 없음"
open_questions: []
intent_deviation: null
risks:
  - "credit-note.js:90과 quote.js는 합계 기준 반올림이라 청구서와 1원 안팎으로 어긋날 수 있음(비목표)"
  - "공급가액이 음수인 줄의 floor 동작은 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 차단은 없었다. 사람이 고른 README 한 줄만 반영해 커밋했다(bfbd6a7). 최종 코드에서 `npm test` 53건 통과, INV-2031은 29,079원이며 완료조건 7개가 모두 통과다. 바뀐 테스트 파일은 test/total.test.js뿐이고 추가만 있어 약화 아님이다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없고, 사람이 알려 준 청구서 부가세 규칙과 아직 따르지 않는 곳(CN, 견적)을 남김
## 다음 task가 알아야 할 것
- 수정 지점은 `src/invoice/total.js:27-29`이다.
- 규칙은 `docs/knowledge/invoice/vat-per-line-floor.md`에 있다.
- `src/invoice/credit-note.js:90`과 `src/invoice/quote.js`는 아직 합계 기준 반올림이다.
- 확인 명령은 `npm test`이다.
