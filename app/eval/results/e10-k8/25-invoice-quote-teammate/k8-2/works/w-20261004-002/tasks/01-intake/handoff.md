---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "CN-0112의 기대 환불 합계는 19,180원(현재 19,182원)"
    why: "사람이 회계팀 계산값을 알려 줌"
    by: human
  - what: "부가세 규칙은 팀 지식(줄별 원 단위 버림 합)을 제약으로 옮겼다"
    why: "팀 지식 vat-per-line-floor.md의 사람 규칙이 반품 전표에도 적용된다고 적혀 있음"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 줄별 버림 규정과 같다고 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 기준 브랜치에는 `lineVatSum`이 아직 없다. 이 Work에서 필요하면 충돌 가능성이 있다"
recommended_next: null
knowledge_candidates:
  - "CN-0112(INV-2047 반품) 회계팀 환불 합계는 19,180원 (사람)"
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도를 정리했다. 팀 지식의 부가세 규칙과 저장 합계 불변 규칙을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js` 의 `creditTotals`(참고용 가설, 확인 안 됨: 부가세를 과세분 전체에 한 번 반올림해 계산하는 부분)
- 테스트: `npm test` (`node --test`), 관련 파일 `test/credit-note.test.js`
- 참고 팀 지식: docs/knowledge/invoice/vat-per-line-floor.md, docs/knowledge/invoice/issued-totals-and-format.md (기준 브랜치에는 아직 없음)
- `lineVatSum`은 현재 코드에 없음(grep 결과 0건)
