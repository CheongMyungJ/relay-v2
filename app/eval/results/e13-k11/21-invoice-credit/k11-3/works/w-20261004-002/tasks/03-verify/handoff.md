---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 골랐다. 동작과 완료조건에 영향이 없는 사소한 지적이다"
    by: human
assumptions:
  - "회계팀 계산은 줄별 버림 규칙과 같다고 가정함 (기대 합계 19,180)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: creditTotals 줄별 버림. 머지 시 충돌 가능"
  - "비율 할인 반올림(322.5→323)이 회계팀 방식과 다를 수 있으나 확인하지 않음"
  - "청구서 계산 src/invoice/total.js는 비목표라 이 브랜치에서 건드리지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건뿐이고 반영하지 않았다. 완료조건 6개 모두 통과했다. 재현 절차 CN-0112는 부가세 1,742원, 합계 19,180원이다. `npm test`는 49개 통과다. 바뀐 테스트 파일은 추가만 있어 약화 아님이다. `pr.md`를 썼다.
남긴 지식: 없음 (이 Work가 알아낸 규칙은 vat-per-line-floor.md가 이미 담고 있고, 그 `바뀐 이력`에 creditTotals 변경도 적혀 있다. 새로 정해지거나 어긋난 규칙이 없다)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js:90-91` `creditTotals`
- 테스트: `test/credit-note.test.js` 끝의 추가 3개
- 반영하지 않은 사소 지적: vat 식 변수 분리, 테스트의 `mixed` 이름
