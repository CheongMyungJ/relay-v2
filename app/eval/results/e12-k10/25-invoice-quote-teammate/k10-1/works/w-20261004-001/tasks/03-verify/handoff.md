---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 3건(사소 2, 권장 1)을 모두 반영하지 않음"
    why: "동작에 영향 없거나 intent 범위 밖이라 남은 위험으로 기록"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "일부 수량 반품 대변전표의 줄 부가세가 원 청구서 비례분과 1원 어긋날 수 있음"
  - "청구서·대변전표의 영세율 0원 테스트 없음(견적만 있음)"
  - "소수 세율에서는 vatOfLines 부동소수 경계 오차 가능(현재 10%)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건은 사람이 반영하지 않기로 했다. 완료조건 8개 모두 통과(npm test 52 pass, INV-2031 29,079원). 테스트 파일 3개는 추가만 있어 약화 아님.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 항목 없음
새 지식: docs/knowledge/billing/issued-invoice-stored-totals.md — 맞는 기존 항목이 없는 까닭: 기존 항목 없음
## 다음 task가 알아야 할 것
- 공용 함수 `src/money.js` `vatOfLines`, 사용처 total.js:26, credit-note.js:90, quote.js:40
- 검증 명령: `npm test`, `node /tmp/r.mjs examples/INV-2031.json`
- 산출물: verification.md, pr.md
