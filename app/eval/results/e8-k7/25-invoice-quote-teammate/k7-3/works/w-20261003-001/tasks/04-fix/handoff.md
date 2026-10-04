---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서와 반품 전표도 줄별 원 단위 버림 합으로 계산하는 공용 함수 vatOfRows를 쓴다"
    why: "사람 추가 지시. 합계 재반올림 없음"
    by: human
  - what: "발행분 저장 합계와 src/format/은 건드리지 않는다"
    why: "사람 추가 지시와 intent 비목표"
    by: human
assumptions:
  - "Q-0457은 createQuote 시점에 합계가 저장되므로 이미 만든 견적의 저장값은 다시 계산하지 않는다고 본다"
rejected:
  - "발행분 재계산 가설: invoiceTotals와 creditNoteTotals가 저장된 totals를 쓰므로 해당 없음"
open_questions: []
intent_deviation: null
risks:
  - "견적서의 기존 계산 방식(할인 전 금액 기준)이 바뀌어 이미 고객에게 나간 견적과 새 견적 값이 다를 수 있음"
  - "src/format/을 쓰는 PDF 출력은 실행해 보지 않음. 파일 변경은 없음"
recommended_next: null
knowledge_candidates:
  - "견적서(Q-0457)와 반품 전표(CN-0112)도 청구서와 같은 회계 규칙(줄별 원 단위 버림 부가세 합, 합계 재반올림 없음)을 쓴다. Q-0457 vat 3,587, CN-0112 vat 1,742 (사람)"
  - "부가세 계산은 src/invoice/total.js의 vatOfRows 한 곳에 둔다. 청구서, 견적서, 반품 전표가 공유한다"
---
## 요약
청구서, 견적서, 반품 전표의 부가세를 줄별 버림 합으로 통일했다. INV-2031 29,079원, Q-0457 vat 3,587, CN-0112 vat 1,742가 나온다. 테스트 4개를 추가했고 수정 전에는 실패했다. npm test는 52개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `vatOfRows`: 공용 부가세 함수
- 검증 명령: `node src/cli.js examples/Q-0457.json`, `node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json`
- 수정 전 값: Q-0457 vat 3,589, CN-0112 vat 1,744
- 발행분 저장 합계 경로(`invoiceTotals`, `creditNoteTotals`)와 `src/format/`은 변경 없음
