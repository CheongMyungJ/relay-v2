---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "세율 10% 정수 기준이라 net*10/100의 부동소수점 오차는 없다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 creditTotals는 합계 기준 반올림이라 청구서와 방식이 다름 (비목표)"
  - "발행 전 청구서의 합계는 달라질 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 재현 절차(vat 2641, total 29079)와 `npm test`(49 통과)를 다시 실행해 완료조건 6개 모두 통과로 판정했다. 바뀐 테스트 파일은 추가만 있어 약화 아님. `pr.md` 작성.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 부가세 줄별 버림 규칙과 creditTotals 미적용 위치를 다룬 기존 항목이 없음
새 지식: docs/knowledge/invoice/issued-invoice-totals-and-format.md — 발행분 재계산 금지와 src/format/ 불변 규칙을 다룬 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat`, `computeTotals`.
- 확인 명령: `npm test`
- 반품 전표 `src/invoice/credit-note.js`의 `creditTotals`는 아직 옛 방식.
