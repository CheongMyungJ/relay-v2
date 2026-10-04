---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(지식 문서 갱신)을 모두 반영"
    why: "사람이 모두 반영을 선택"
    by: human
  - what: "npm test 실패(9건)를 완료 화면으로 진행(경고)"
    why: "원인이 비목표인 computeTotals 버그라 별도 Work에서 고친다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "npm test 9건 실패가 남음. computeTotals(total.js:31)가 lineVat에 객체를 넘겨 면세·영세율 청구서 부가세가 과다 계산됨"
  - "견적서 줄별 버림 적용은 확정이 아님(경리 금액과의 일치만 근거)"
  - "요청의 56,280원 출처 미확인"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 코드 지적은 없었고 지식 문서 갱신 2건을 반영했다(커밋 3e61f30). 완료조건 중 `npm test 통과`만 실패(pass 46 / fail 9, 기준 커밋에서도 실패), 나머지는 통과. 테스트 파일 변경 없음.
고친 지식: docs/knowledge/invoice/vat-rule.md — quoteTotals 항목 제거, computeTotals 현재 상태(객체 전달 버그, 사람이 범위에서 뺌)로 수정
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 견적서 적용 여부 미정 항목을 현재 상태로 정리
## 다음 task가 알아야 할 것
- 수정: `src/invoice/quote.js:39`
- 남은 실패 9건: `src/invoice/total.js:31` `computeTotals`의 `lineVat` 객체 전달. `r.taxable && !invoice.zeroRated`로 바꾸면 될 것으로 보이나 비목표라 시도하지 않음.
- 확인 명령: `node --test test/quote.test.js`, `npm test`
