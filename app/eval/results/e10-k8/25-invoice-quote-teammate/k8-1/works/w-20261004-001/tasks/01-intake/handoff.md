---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 규칙은 줄별 부가세 원 단위 버림 후 합산, 합계 재반올림 없음"
    why: "사람이 회계팀 규칙으로 직접 알려 줌 (INV-2031 기대 합계 29,079원)"
    by: human
assumptions:
  - "발행된 청구서에 저장된 합계가 있고 그 경로는 이미 재계산하지 않는다고 가정함. 코드로 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "신규 청구서 외에 견적(quote)·대변 전표(credit-note)가 computeTotals를 공유하면 같이 바뀔 수 있음"
  - "저장된 합계를 쓰는 경로가 실제로 있는지 fix에서 확인 필요"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 할인 후 줄 금액마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (회계팀 규칙) (사람)"
  - "이미 발행된 청구서는 재계산하지 않고 저장된 합계를 그대로 쓴다 (사람)"
  - "src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸면 안 된다 (사람)"
---
## 요약
INV-2031 합계가 회계팀보다 3원 큰 문제의 의도를 정리했다. 회계팀 규칙과 기대 합계 29,079원을 완료조건에 반영했다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/total.js`의 `computeTotals`. 현재 부가세는 과세 공급가액 합에 한 번 반올림 적용.
- 참고(가설, 의도에는 없음): 줄별 net은 5368, 6335, 3255, 8375, 3105(합 26,438). 줄별 버림 VAT는 536+633+325+837+310=2,641이라 합계 29,079로 맞는다. 현재 방식은 round(2643.8)=2,644로 29,082.
- 테스트 명령: `npm test` (node --test). 데이터는 `examples/INV-2031.json`.
