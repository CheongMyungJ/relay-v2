---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected:
  - "quote.js 계산 오류: 이미 lineVatSum을 쓰며, 중복 제거만으로 56,278원이 나옴"
open_questions: []
intent_deviation: null
risks:
  - "거래처가 받은 56,280원이 어느 경로에서 나왔는지는 확인하지 않음(줄별 버림 이전 계산값과 일치)"
recommended_next: null
knowledge_candidates:
  - "머지 뒤 같은 함수가 한 파일에 두 번 선언돼 모듈 로드가 실패한 적이 있다(total.js lineVatSum). 병렬 Work를 머지한 뒤에는 npm test로 로드 오류를 확인한다."
---
## 요약
total.js에 중복 선언된 lineVatSum을 제거해 모듈이 로드되게 했다. Q-0457 견적은 합계 56,278원이 나온다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` 끝의 중복 선언 삭제. 재현 테스트는 `test/vat-per-line.test.js` 마지막.
- `npm test` 60개 통과. 수정 전 7개 실패는 기준 커밋에서도 실패.
