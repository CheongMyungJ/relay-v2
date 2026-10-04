---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 팀 지식의 줄별 원 단위 버림 규칙을 따른다"
    why: "팀 지식 vat-per-line-floor.md의 규칙이 반품 전표에도 통하고, 그 문서가 credit-note.js를 아직 규칙을 따르지 않는 곳으로 적음"
    by: ai
assumptions:
  - "회계팀 기준 금액은 팀 지식의 줄별 버림 방식과 같다고 가정함(CN-0112의 회계팀 계산값은 요청에 없음)"
  - "청구서 쪽 계산은 이미 규칙을 따른다고 보고 범위에서 뺌"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 같은 규칙의 청구서 쪽 부가세 계산"
  - "반품 줄의 금액 할인 안분(Math.round)도 어긋남의 원인일 수 있으나 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 부가세를 줄별 버림으로 계산하는 팀 규칙을 제약에 옮겼고, 저장된 금액 재계산 금지와 `src/format/` 불변을 비목표와 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 테스트 명령은 `npm test`(`node --test`). 관련 테스트는 `test/credit-note.test.js`.
- 팀 지식 `docs/knowledge/invoice/vat-per-line-floor.md`(이 브랜치에는 없음): 줄별 `Math.floor` 규칙. 이 파일이 `src/invoice/credit-note.js:90` 합계 기준 `Math.round`를 고칠 대상으로 적음.
- 참고(가설, 확인 안 됨): `creditTotals`의 부가세 계산(`credit-note.js` 약 88~90행)과 `returnedDiscount`의 금액 할인 `Math.round` 안분이 어긋남 후보.
- 예시 파일: `examples/CN-0112.json`, `examples/INV-2047.json`. 저장 금액 경로는 `creditNoteTotals`(`note.totals ?? ...`).
