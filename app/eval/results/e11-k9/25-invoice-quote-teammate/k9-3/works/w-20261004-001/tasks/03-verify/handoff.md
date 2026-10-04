---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(권장), 2(사소)를 모두 반영"
    why: "사람이 '모두 반영'을 골랐다. 견적서 할인 테스트가 수정 전 코드로도 통과해 값을 교체"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "INV-2047 같은 발행분은 줄별 계산값(5,798)과 저장값(5,801)이 달라 대조 시 차이가 보일 수 있음(의도됨)"
  - "반품 전표의 비례 할인 반올림(credit-note.js)은 이번에 바꾸지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(테스트 값 교체와 주석 정리)을 반영해 커밋 377bc76으로 남겼다. `npm test` 55 pass, 완료조건 8개 모두 통과, 바뀐 테스트 파일은 새 파일 하나로 약화 아님. `verification.md`, `pr.md`를 썼다.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 지식 항목이 없었고 회계팀 부가세 규칙(사람)을 처음 남김
새 지식: docs/knowledge/billing/issued-invoice-totals-frozen.md — 맞는 기존 항목이 없는 까닭: 지식 항목이 없었고 발행분 totals 유지 사실을 처음 남김
## 다음 task가 알아야 할 것
- 부가세 계산: `src/invoice/vat.js`의 `lineVat`/`sumLineVat`
- 반품 전표 CLI: `node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json`
- 수정 전 코드 대조: `git checkout 9c71fb2 -- src/invoice/quote.js` 시 견적서 테스트 2개 실패
