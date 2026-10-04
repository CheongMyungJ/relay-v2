---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "배송비 무료 등 다른 선물하기 주문의 고객센터 값은 확인하지 못함. 같은 기준이라고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "이미 저장된 선물하기 주문의 points.earned에는 옛 값(반올림, 배송비 포함)이 남아 있을 수 있음. 비목표라 재계산하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었고 완료조건 7개 모두 통과했다. 재현 명령은 218P, `npm test`는 24개 통과, 기준 커밋 코드로 되돌리면 새 테스트 2건이 실패한다. 테스트 파일은 추가만 있어 약화가 아니다. PR 초안 `pr.md`를 썼다.
고친 지식: docs/knowledge/points/earn-basis.md — 선물하기 적립도 같은 기준이라는 사람의 확인을 `## 규칙`으로 옮기고 `## 아직 정하지 않은 것`을 지웠으며 이력을 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`(`earnPoints` 위임). 테스트: `test/gift.test.js` 4, 5번째.
- 재현: `node -e "import('./src/gift/gift-order.js').then(m=>console.log(m.createGiftOrder(JSON.parse(require('fs').readFileSync('examples/G-0213.json'))).points))"` → `earned: 218`
