---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`floorPercentOf`를 추가하지 않고 `creditTotals`에 `Math.floor` 식을 인라인으로 썼다"
    why: "도우미는 앞 Work(w-20261004-001)에서 만들어 머지 대기라 이 브랜치에 없고, 따로 만들면 머지 때 충돌할 수 있다 (docs/knowledge/billing/vat-per-line-floor.md)"
    by: ai
assumptions:
  - "공급가액이 음수인 줄은 팀 지식에서 미정이라 다루지 않았다. 지금은 Math.floor를 그대로 쓴다"
rejected:
  - "줄 공급가액 계산 오류: 줄별 net이 수동 계산과 일치함"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 `floorPercentOf`를 만들었으니 머지 뒤에는 인라인 식을 그 도우미로 바꿀 수 있음, 머지 대기"
  - "청구서 합계(`src/invoice/total.js`)는 이번 범위 밖이라 아직 Math.round를 쓴다. 앞 Work에서 고쳤을 수 있음, 머지 대기"
  - "음수 공급가액 줄의 부가세는 미정이고, 지금은 0에서 멀어지는 쪽으로 내림한다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 공급가액이 음수인 줄의 부가세 — 정해지지 않았고, 반품 전표 `creditTotals`도 지금 Math.floor 상태 (사람)"
---
## 요약
반품 전표 부가세를 과세 줄마다 버림한 합으로 계산하게 고쳤다. CN-0112는 부가세 1,742원, 합계 19,180원이 된다. 재현 테스트를 추가했고 `npm test`는 49개 모두 통과했다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js` `creditTotals`의 vat 줄.
- 추가한 테스트: `test/credit-note.test.js` 끝의 3개 (CN-0112, 면세·영세율 0, 저장된 totals 재사용).
- `src/format/`은 바뀌지 않았다. 커밋은 1개다.
- 테스트 명령: `npm test`
