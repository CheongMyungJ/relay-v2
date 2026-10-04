---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "청구서(total.js)의 같은 호출 오류도 함께 고친다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md: 세 문서가 lineVat을 함께 씀. 같은 원인이며 npm test 통과 조건에 필요"
    by: ai
  - what: "credit-note.test.js의 중복 import 한 줄을 지운다"
    why: "파일이 SyntaxError로 로드되지 않아 npm test 통과 불가. 단언은 변경 없음"
    by: ai
assumptions:
  - "요청의 현재 합계 56,280원은 이전 구현(합계 기준 반올림) 값으로 보았다. 현 코드는 NaN 예외였다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 파일 test/credit-note.test.js 변경(중복 import 삭제). 약화 여부는 verify가 판단"
  - "작업 중 git stash를 잠깐 써서 수정 전 상태를 확인했고 바로 복원함"
recommended_next: null
knowledge_candidates:
  - "실패 유형: `rows.map(lineVat)`처럼 콜백에 행 객체를 그대로 넘기면 lineVat(net)이 NaN을 낸다. 항상 `lineVat(r.net)`으로 호출한다 (src/invoice/quote.js, total.js)"
---
## 요약
견적서와 청구서가 `lineVat`에 행 객체를 넘겨 NaN이 되던 호출을 `lineVat(r.net)`으로 고쳤다. Q-0457 합계는 56,278원(vat 3,587)이고 `npm test`는 54건 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/quote.js:42`, `src/invoice/total.js:31`
- 회귀 테스트: `test/quote.test.js` Q-0457 (이미 존재, 수정 전 실패 확인)
- `test/credit-note.test.js` 중복 import 한 줄 삭제(기존 테스트 변경)
- 실제 증상은 56,280원이 아니라 NaN 예외였다
