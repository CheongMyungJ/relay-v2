---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄 부가세 `lineVat`를 total.js에 두고 반품 전표만 이를 쓰게 했다"
    why: "팀 지식 docs/knowledge/vat/line-floor-vat.md의 규칙(줄별 원 단위 버림 합산, lineVat 공유)을 따름"
    by: ai
assumptions:
  - "줄 할인 계산(percentOf의 반올림, 322.5→323)은 규정 밖이라 그대로 두었다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서(computeTotals)와 견적서(quoteTotals)는 이 브랜치에서 여전히 합계 반올림 방식이다. 의도의 비목표('이미 규정대로라면')와 달리 규정과 다를 수 있으나 범위를 넓히지 않았다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 lineVat 정의가 겹칠 수 있다"
  - "앞 Work 머지 후 total.js의 lineVat가 충돌할 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 과세 줄마다 원 단위 버림으로 계산해 합하도록 고쳤다. CN-0112 환불은 부가세 1,742, 합계 19,180원이 된다. 재현 테스트는 수정 전 실패, 후 통과, `npm test` 50개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` creditTotals, `src/invoice/total.js` lineVat
- 테스트: `test/credit-note.test.js` 끝의 2개
- 저장된 totals 경로(`creditNoteTotals`)와 `src/format/`은 변경 없음
- 청구서·견적서 계산은 손대지 않음
