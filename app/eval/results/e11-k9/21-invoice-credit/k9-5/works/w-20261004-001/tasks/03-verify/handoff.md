---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "세율 10%와 정수 원에서는 net × 세율 / 100의 부동소수점 오차가 문제 없다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/credit-note.js:90 은 아직 합계 기준 Math.round. 사람이 범위에서 뺌. 반품 전표와 청구서 부가세가 어긋날 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었고 완료조건 8개가 모두 통과했다(npm test 48개, INV-2031 vat 2641, total 29079). 바뀐 테스트 파일은 추가만 있어 약화가 아니다.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었다
## 다음 task가 알아야 할 것
- 변경 코드: `src/invoice/total.js` computeTotals의 vat
- 확인: `node src/cli.js examples/INV-2031.json --totals`, `npm test`
- 남은 일: `src/invoice/credit-note.js:90` 반품 전표 부가세를 같은 규칙으로 고치는 별도 일
