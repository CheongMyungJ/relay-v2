---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서와 반품 전표도 부가세를 줄별 절사로 계산한다"
    why: "verify 단계에서 사람이 직접 말함: 회계 규정은 문서 종류 구분 없이 부가세를 품목 줄마다 원 단위 버림으로 계산해 합치고 합계에서 다시 반올림하지 않으며, 할인은 부가세 전에 줄마다 적용한다. 그러니 견적서와 반품 전표도 줄별 절사로 고쳐 달라(Q-0457 56,278, CN-0112 19,180)고 요청함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서·반품 전표 변경은 intent 버전 1에 없던 범위 확장(사람 요청). 견적서는 만들 때 합계를 계산해 이미 보낸 견적서와 몇 원 다를 수 있음"
  - "초안 청구서는 새 방식의 합계가 발행 시 저장됨. 발행된 청구서는 영향 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었다. 7개 완료조건 모두 최종 코드에서 직접 실행해 통과로 판정했다(`npm test` 53개 통과, INV-2031 vat 2641 / total 29079). 이후 사람 요청으로 견적서·반품 전표도 줄별 절사로 고쳤다(Q-0457 56,278, CN-0112 19,180). 바뀐 테스트 파일 3개는 모두 추가만 있어 약화 아님이다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 팀 지식 항목이 하나도 없었음. 사람이 문서 종류 무관 규칙으로 알려 줌
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat`(export)과 `computeTotals`의 vat 합산. `quote.js` `quoteTotals`, `credit-note.js` `creditTotals`도 `lineVat`을 씀.
- 시험 명령: `npm test`
- 커밋: 6783ada(청구서), e788ae6(지식), a886b32(견적서·반품 전표)
