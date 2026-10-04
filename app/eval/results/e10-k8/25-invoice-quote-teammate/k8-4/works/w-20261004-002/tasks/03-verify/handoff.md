---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않음"
    why: "사람이 반영하지 않음을 선택. 동작 결함이 아님"
    by: human
  - what: "CN-0112 기준 금액을 규칙 계산값 19,180원으로 보고 재현 완료조건을 통과로 판정"
    why: "intent 추가 의견이 규칙으로 계산한 값을 기준으로 삼으라고 함"
    by: ai
assumptions:
  - "회계팀 실제 금액은 규칙 계산값(19,180원)과 같다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "회계팀의 실제 CN-0112 금액 미확인"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 청구서 computeTotals(src/invoice/total.js)는 아직 합계 기준 Math.round"
  - "부분 반품 시 금액 할인의 수량 안분 반올림으로 청구서 줄 할인과 1원 차이날 수 있음(미확인)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 사소한 지적 2건(반영 안 함), 완료조건 7개 모두 통과. CN-0112는 기준 커밋 19,182원, 현재 19,180원, `npm test` 50개 통과.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 반품 전표에도 줄별 버림 규칙 적용을 규칙에 더하고 '아직 따르지 않는 곳'에서 반품 전표를 뺌 (기준 브랜치에 없던 파일이라 앞 내용을 살려 새로 씀)
## 다음 task가 알아야 할 것
- fix.md의 재현 스크립트 경로(/tmp/claude-0/repro.mjs)는 다른 Work의 INV-2031용이라 이 Work 재현에 쓸 수 없다. `createCreditNote(examples/INV-2047.json, examples/CN-0112.json).totals`를 직접 호출해 확인했다.
- 수정 위치: src/invoice/credit-note.js:90 `creditTotals`
