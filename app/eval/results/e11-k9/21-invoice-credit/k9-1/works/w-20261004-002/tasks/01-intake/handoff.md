---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세 규칙은 팀 지식의 줄별 버림 규칙을 제약으로 옮긴다"
    why: "사람이 정한 회계팀 규칙(docs/knowledge/invoice/vat-per-line-floor.md)이고 이번 요청이 그 규칙을 어기는 곳을 고치는 일이다"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 줄별 버림 규칙과 같다고 가정함. CN-0112의 회계팀 기대 금액은 요청에 없음"
  - "금액 할인을 수량 비율로 나눌 때의 반올림(returnedDiscount)은 이번 요청 범위 밖으로 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "회계팀의 CN-0112 기대 합계를 모르므로 규칙 적용 결과로만 맞는지 확인할 수 있음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기 (청구서 쪽 부가세 계산)"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 intent 초안을 썼다. 팀 지식의 부가세 규칙을 제약에 옮겼고, 저장된 금액 유지와 `src/format/` 불변을 비목표로 뒀다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/invoice/credit-note.js`의 `creditTotals`(부가세 계산), `returnedDiscount`(할인 안분)
- 예시: `examples/CN-0112.json`, `examples/INV-2047.json` (현재 환불 합계 19,182원)
- 테스트: `npm test`(`node --test`), 관련 파일 `test/credit-note.test.js`
- 참고 팀 지식: `docs/knowledge/invoice/vat-per-line-floor.md` (기준 브랜치에는 아직 없음). 이 파일의 "아직 규칙을 따르지 않는 곳"이 `creditTotals`를 가리킨다. 원인 확정은 fix에서 한다.
