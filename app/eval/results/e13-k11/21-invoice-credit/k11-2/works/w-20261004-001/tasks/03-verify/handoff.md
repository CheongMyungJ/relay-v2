---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2(사소)는 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 할인 안분(`returnedDiscount`) 반올림은 규정 밖이라 그대로 둠"
  - "저장된 합계를 쓰는 경로는 코드상 미변경이며 새 테스트로 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 차단·권장 없음, 사소 2건은 반영하지 않았다. 완료조건 9개 모두 통과했고 `npm test` 50개가 통과한다. 테스트 파일 변경은 추가뿐이라 약화 아님이다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 항목 없음(부가세 줄별 버림 규정)
새 지식: docs/knowledge/invoice/issued-totals-and-format-frozen.md — 맞는 기존 항목이 없는 까닭: 기존 항목 없음(발행본 합계 고정, format 불변)
## 다음 task가 알아야 할 것
- 산출물: verification.md, pr.md
- 수정 코드: `src/invoice/total.js` `lineVat`, `src/invoice/credit-note.js` `creditTotals`
- 직접 확인: INV-2031 2,641원/29,079원, CN-0112 1,742원/19,180원
