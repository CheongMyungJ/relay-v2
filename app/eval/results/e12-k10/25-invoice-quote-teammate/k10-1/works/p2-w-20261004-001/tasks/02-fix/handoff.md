---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "중복된 vatOfLines 중 rows 버전(rows, percent, zeroRated)을 남기고 청구서·견적 호출부를 맞춘다"
    why: "대변전표와 money.test.js가 이미 rows 버전을 쓰고, 팀 지식 docs/knowledge/billing/vat-per-line-floor.md가 세 문서의 공용 함수 사용을 규정"
    by: ai
assumptions:
  - "견적서 규정은 미확정이지만 줄별 버림이 경리 값 56,278원과 일치하므로 그대로 둔다"
rejected:
  - "할인/줄 금액 계산 오류: 수동 계산에서 이 값들로 56,278원이 나옴"
open_questions: []
intent_deviation:
  summary: "intent는 현재 합계가 56,280원이라 했으나, 기준 커밋에서는 머지로 vatOfLines가 중복 선언되어 모듈이 로드되지 않는다. 56,280원은 1702f40 이전 견적 계산의 값이다"
  evidence: "src/money.js:38,55 중복 선언, node SyntaxError, git show 1702f40 -- src/invoice/quote.js"
risks:
  - "견적서 부가세 규정은 여전히 미확정. 줄별 버림이 경리 값과 맞는 것만 확인함"
  - "추가한 테스트를 기준 커밋에서 따로 실행해 실패를 확인하지는 않음(로드 실패는 npm test로 확인)"
recommended_next: null
knowledge_candidates:
  - "실패 유형: 두 브랜치가 같은 공용 함수(vatOfLines)를 다른 시그니처로 추가해 머지하면 중복 선언 SyntaxError가 난다. 위치 src/money.js. 머지 뒤 npm test로 확인할 것"
  - "정하지 않음: 견적서 부가세 계산 규정 — 청구서를 회계팀과 맞춘 담당 동료가 휴가에서 돌아온 뒤 확인, 지금 코드는 vatOfLines(줄별 버림)를 쓰고 Q-0457이 경리 값 56,278원과 일치 (사람)"
---
## 요약
머지로 `vatOfLines`가 두 번 선언되어 모듈이 깨져 있었다. 하나로 합쳐 Q-0457이 56,278원이 되게 했고 테스트를 추가했다. npm test 55개 통과.
## 다음 task가 알아야 할 것
- `src/money.js`의 `vatOfLines(rows, percent, zeroRated)`만 남음. 호출: `quote.js:40`, `total.js:26`, `credit-note.js:91`.
- Q-0457: 공급가액 52,691, 부가세 3,587, 합계 56,278. 옛 방식 값은 56,280.
- 테스트: `npm test`.
