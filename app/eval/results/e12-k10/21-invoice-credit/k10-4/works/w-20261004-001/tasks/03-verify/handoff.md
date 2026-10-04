---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(할인 줄 없는 할인 기준 테스트)을 반영, 차단·권장만 반영"
    why: "청구서 쪽 할인 후 금액 기준 근거 보강"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 반품 전표의 줄별 버림 합이 원 청구서 부가세와 1원 단위로 어긋날 수 있음 (확인하지 않음)"
  - "이미 발행된 청구서는 옛 방식 totals를 유지해 신규와 기존 값이 섞임 (의도된 비목표)"
  - "net이 음수인 줄은 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(권장)을 반영해 커밋(29824c5)했다. 완료조건 7개 모두 통과, `npm test` 49 통과. INV-2031은 vat 2,641, 합계 29,079원.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없고(docs/knowledge 없음), 사람이 알려 준 부가세 규칙과 대조값을 남김
## 다음 task가 알아야 할 것
- 계산 위치: `src/invoice/total.js`의 `lineVat`/`sumLineVat`
- 보강한 테스트: test/total.test.js 할인 줄 테스트(기대 201)
- 테스트 파일 변경은 모두 추가뿐, 약화 없음
