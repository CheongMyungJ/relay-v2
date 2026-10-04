---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "영세율 반품의 부가세 0 경로를 직접 확인하는 테스트가 없음"
  - "부분 반품 금액 할인은 수량 비율 반올림 그대로라 줄별 규칙과 1원 차이가 날 수 있음"
  - "src/invoice/total.js의 computeTotals도 Math.round 방식일 수 있음. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 차단·권장 지적은 없었고 사소 2건은 반영하지 않기로 했다. 완료조건 6개 모두 통과했다. CN-0112는 vat 1742, 환불 합계 19,180원이고 `npm test`는 47개 통과, 변경 파일은 `src/invoice/credit-note.js`와 `test/credit-note.test.js`뿐이다. `pr.md`를 썼다.
남긴 지식: 없음 (이번 Work에서 새로 알게 된 규칙은 기존 `docs/knowledge/vat-per-line-floor.md`가 이미 덮고, 사람이 새로 알려 준 규칙이 없다)
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js`의 `creditTotals`. 재현 테스트: `test/credit-note.test.js` 마지막 테스트.
- 검증 명령: `npm test` (47 pass).
- 반영하지 않은 지적: 테스트의 동적 import 정리, 영세율 테스트 추가.
