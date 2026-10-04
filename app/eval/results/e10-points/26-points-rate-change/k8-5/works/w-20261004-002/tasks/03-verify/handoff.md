---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1~3을 모두 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 선택. 1번은 입력에 이전 회수분이 없어 의도 식 범위 밖"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 주문에 부분 환불이 여러 번이면 이전 환불에서 회수한 몫이 중복 회수될 수 있다. 테스트하지 않음"
  - "`earnPoints`(`src/points/earn.js`)와 `percentOf`는 아직 반올림. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "`Math.max(0, ...)` 하한 분기 테스트 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건(권장 1, 사소 2)을 사람이 모두 반영하지 않기로 했다. 완료조건 7개 모두 통과(재현 132P, `npm test` 21개, `refundAmount` 13130, `src/format/` 무변경). 바뀐 테스트 파일은 추가만 있어 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 부분 환불 회수 계산식(저장된 적립 − 남은 상품 기준 버림, O-1077 132P) 추가. 앞 Work의 기존 내용은 모두 살려 같은 경로에 씀
## 다음 task가 알아야 할 것
- `src/orders/refund.js:30-31` 회수 계산, `src/money.js` `floorPercentOf`
- 다회 부분 환불 중복 회수 위험은 risks 참고
- 재현: `examples/O-1077.json` + `examples/R-0311.json`으로 `createRefund` → `pointsRecovered` 132
