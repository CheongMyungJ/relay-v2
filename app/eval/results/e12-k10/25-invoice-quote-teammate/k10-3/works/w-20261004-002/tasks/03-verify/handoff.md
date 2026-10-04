---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 권장 1번(면세·영세율 반품 전표 테스트)만 반영하고 사소 2·3번은 반영하지 않음"
    why: "사람이 차단·권장만 반영을 골랐다"
    by: human
  - what: "모든 완료조건을 통과로 판정"
    why: "재현 스크립트, npm test 51개 통과, format 무변경을 직접 다시 확인"
    by: ai
assumptions:
  - "computeTotals/quoteTotals는 사람이 따로 범위에서 뺀 것이 아니라 요청 범위(반품 전표) 밖이라 그대로 둔 것으로 보고 지식 항목에 사실로만 적음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: lineVat 중복 정의로 머지 충돌 가능"
  - "computeTotals/quoteTotals는 아직 줄별 버림이 아님"
  - "반품 전표와 옛 규칙 저장 청구서의 부가세 차이는 보정하지 않음(사람 결정)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 차단 지적은 없었고, 권장 1건(면세·영세율 테스트)만 반영해 커밋했다. 완료조건 6개 모두 통과, `npm test` 51개 통과, CN-0112 환불 합계 19,180원을 직접 확인했다. 테스트 파일 변경은 추가뿐이라 약화 아님.
고친 지식: docs/knowledge/invoice/vat-rule.md — 이 브랜치에 파일이 없어 앞 내용을 살려 같은 경로에 쓰고, 저장된 totals 재계산 금지 규칙을 사람이 확인한 범위로 정리, 아직 따르지 않는 곳(computeTotals, quoteTotals)과 이력을 더함
## 다음 task가 알아야 할 것
- 커밋: 5a8f14a(테스트 추가), 그 위에 지식 문서 커밋. 수정 코드는 288af66.
- `src/invoice/total.js` `lineVat`, `src/invoice/credit-note.js:91` `creditTotals`.
- 명령 `npm test`(51개 통과). 재현: INV-2047에 CN-0112를 `createCreditNote`로 적용하면 vat 1742, total 19180.
- 머지 때 w-20261004-001의 `lineVat`과 충돌 가능.
