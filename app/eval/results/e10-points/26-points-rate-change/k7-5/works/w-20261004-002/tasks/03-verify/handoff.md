---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1·2를 모두 반영하기로 함 (1은 코드로 반영 불가, 2는 0 하한 테스트 추가)"
    why: "사람이 '모두 반영'을 고름"
    by: human
  - what: "완료조건 6(영수증 출력이 수정 전과 같다)은 판정 불가로 두고 완료 화면으로 간다"
    why: "회수 포인트 줄이 -131P에서 -132P로 바뀌어 완료조건 1과 동시에 만족할 수 없음"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation:
  summary: "영수증의 회수 포인트 줄이 -131P에서 -132P로 바뀌어 완료조건 6과 어긋남"
  evidence: "`node src/cli.js examples/R-0311.json --order examples/O-1077.json`: 수정 전 -131P, 후 -132P. 환불 금액 13,130원과 src/format/은 그대로"
risks:
  - "alreadyRefunded가 있으면 이전 환불에서 이미 회수한 포인트를 다시 회수하는 누적값이 됨 (refund.js:37)"
  - "저장된 earned가 옛 기준이면 재계산 적립이 더 커서 0으로 잘릴 수 있음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 0 하한 테스트를 추가(e7c25c1)하고 `npm test` 23개 통과를 확인했다. 완료조건 5개 통과, 6번(영수증 동일)은 회수 줄이 -132P로 바뀌어 판정 불가다. 누적 회수 문제(지적 1)는 코드로 고칠 수 없어 위험으로 남겼다.
남긴 지식: docs/knowledge/partial-refund-points-recovery.md
## 다음 task가 알아야 할 것
- `src/orders/refund.js:37` 회수 계산, `test/refund.test.js` 테스트 3개 추가
- 재현: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P
- 완료조건 6은 사람이 intent 문구를 판단해야 한다
