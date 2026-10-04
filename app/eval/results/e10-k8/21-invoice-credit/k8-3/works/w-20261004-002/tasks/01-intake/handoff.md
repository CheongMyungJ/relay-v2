---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 금액은 팀 지식의 줄별 절사 규칙에 맞춘 값(CN-0112 합계 19,180원)으로 한다"
    why: "사람이 회계팀 계산 CN-0112 환불 합계 19,180원이라고 알려 줌"
    by: human
  - what: "이미 저장된 반품 전표 totals는 고치지 않고 새 계산부터 적용한다"
    why: "사람이 '새 계산부터 적용'을 선택. 저장된 totals 고정 규칙과 같다"
    by: human
assumptions:
  - "팀 지식의 부가세 줄별 절사 규칙이 반품 전표에도 적용된다고 보았다(규칙이 이번 경우를 덮음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 두 항목은 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 아직 없다. 머지 대기 중이라 이 브랜치에 docs/knowledge/가 없고, 청구서 쪽 줄별 절사 수정(src/invoice/total.js)도 아직 없을 수 있다"
recommended_next: null
knowledge_candidates:
  - "반품 전표(src/invoice/credit-note.js creditTotals)도 부가세는 청구서와 같이 과세 줄마다 절사해 합산한다. 회계팀 기준 CN-0112 환불 합계는 19,180원 (사람)"
  - "이미 저장된 반품 전표 totals는 새 계산 방식이 나와도 다시 계산하지 않는다 (사람)"
---
## 요약
반품 전표 환불 금액이 회계팀 계산보다 몇 원 많은 버그의 의도를 정리했다. 기대값은 CN-0112 합계 19,180원(현재 19,182원)이고, 저장된 기존 전표는 건드리지 않는다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js` `creditTotals`의 `vat` 계산(팀 지식에 '아직 규칙을 따르지 않는 곳'으로 적힘).
- 참고 지식: docs/knowledge/invoice/vat-per-line-floor.md, docs/knowledge/invoice/issued-invoice-totals-frozen.md (둘 다 앞 Work 머지 대기, 이 브랜치에는 없음).
- 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트는 `npm test`(`node --test`), 관련 파일 `test/credit-note.test.js`.
- 원인은 확인하지 않았다(intake 범위 밖).
