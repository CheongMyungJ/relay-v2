# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-4/relay-home-2/projects/shop-mate1-c50e1f/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: da7afc0a899f7df54fc069169c4f314edbe4812b

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/points/order-earn-points.md

```markdown
---
kind: rule
source: human
anchor: earnPoints
---
# 일반 주문 적립 포인트는 (상품−쿠폰−사용 포인트)의 1%를 버림한다

## 규칙
- 일반 주문(O-)의 적립 기준 금액은 상품 금액 − 쿠폰 할인 − 사용 포인트이며 배송비는 포함하지 않는다.
- 적립 포인트는 기준 금액의 1%(`POINT_RATE_PERCENT`)를 원 단위 미만 버림한다. 예: O-1042는 23,770원 → 237P (반올림이면 238P).
- 적립 값은 주문 생성 때 `points.earned`에 저장하고, 영수증·환불·내역은 저장된 값을 쓴다.

## 아직 규칙을 따르지 않는 곳
- src/orders/refund.js: 부분 환불 `pointsRecovered`가 `percentOf(refundGoods, ...)` 반올림이라 적립 규칙(버림)과 다를 수 있다.
- src/gift/gift-points.js: 선물 적립은 `total` 기준 반올림이다. 선물 규칙은 이번 Work의 비목표라 사람 확인 전에는 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/points/percent-of-rounding.md

```markdown
---
kind: pitfall
source: investigation
anchor: percentOf
---
# percentOf(src/money.js)는 반올림이며 여러 곳이 공유한다

## 내용
- `percentOf`는 `Math.round`로 반올림한다. 선물 적립(`giftPoints`)과 부분 환불 회수 포인트(`refund.js`)가 쓴다.
- 이것을 버림으로 바꾸면 선물과 환불 값이 함께 바뀐다. 일반 주문 적립은 `earnPoints`에서 따로 버림 계산한다(규칙은 docs/knowledge/points/order-earn-points.md 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.
- 사람의 지금 말이 위 항목과 어긋나면(값이나 규칙이 바뀌었으면) "고칠 지식: <경로> — <새 내용> (사람)"으로 후보에 적는다. verify가 그 항목을 고친다.

## 선택 가능한 다음 단계

- 기본 다음 단계: verify (리뷰와 검증)
- 이전 단계: intake (의도 정리)

## intent (버전 1)

```markdown
---
schema_version: 1
version: 1
type: bugfix
---
## 목표
선물하기 주문의 적립 예정 포인트가 같은 상품을 일반 주문으로 샀을 때와 같은 규칙으로 계산되게 한다. 현재 G-0213(`examples/G-0213.json`)은 249P로 나와 고객 문의가 들어왔다.

## 비목표
- 선물 메시지 카드와 받는 사람 정보를 바꾸지 않는다.
- 영수증 글자(`src/format/`)를 바꾸지 않는다.
- 이미 적립된 포인트를 다시 계산하지 않는다.
- 일반 주문 적립(`earnPoints`)과 부분 환불 회수 포인트 계산은 바꾸지 않는다.

## 원하는 결과
선물 주문의 적립 포인트가 일반 주문 규칙(상품 − 쿠폰 − 사용 포인트의 1%, 배송비 제외, 원 단위 미만 버림)을 따른다. G-0213은 (24,860 − 2,000 − 1,000) = 21,860원 기준으로 218P가 된다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (G-0213의 적립 예정 포인트가 249P가 아니라 218P로 나온다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 같은 상품·쿠폰·사용 포인트의 일반 주문과 선물 주문의 적립 포인트가 같다는 테스트가 있다
- [ ] 선물 메시지, 받는 사람 정보, `src/format/`의 출력은 수정 전과 같다
- [ ] 이미 저장된 적립 값을 다시 계산하는 코드를 추가하지 않는다

## 제약
- (팀 지식 `docs/knowledge/points/order-earn-points.md`) 적립 기준 금액은 상품 − 쿠폰 − 사용 포인트이며 배송비는 포함하지 않고, 1%를 원 단위 미만 버림한다.
- (팀 지식 `docs/knowledge/points/percent-of-rounding.md`) `percentOf`는 선물 적립과 환불이 함께 쓰는 반올림 함수라, 이 함수를 버림으로 바꾸면 환불 값까지 바뀐다.

## 추가 의견
- 요청은 "일반 주문과 같게"가 기대 동작이라고 보고 썼다. 팀 지식에는 선물 규칙이 사람 확인 전에는 바꾸지 않는 비목표로 적혀 있었지만, 이번 요청이 선물 적립 수정을 직접 요청한다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-4/relay-home-2/projects/shop-mate1-c50e1f/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:12 (사람 승인)
- [AI] 선물 적립 기대 동작을 일반 주문 적립 규칙과 같게 한다 — 요청이 '같은 상품을 일반 주문으로 샀을 때와 다르다'를 문제로 삼았고, 팀 지식에 일반 주문 규칙이 있다
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물 적립 기대 동작을 일반 주문 적립 규칙과 같게 한다"
    why: "요청이 '같은 상품을 일반 주문으로 샀을 때와 다르다'를 문제로 삼았고, 팀 지식에 일반 주문 규칙이 있다"
    by: ai
assumptions:
  - "선물 주문도 배송비를 적립 기준에서 제외한다 (G-0213 기대값 218P는 이 가정에 따른 계산)"
  - "팀 지식의 선물 적립 비목표 표기는 이번 요청이 선물 수정을 직접 요청하므로 해당하지 않는다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물 주문에 일반 주문과 다른 적립 정책이 의도된 것이라면 기대값이 달라진다"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물 적립을 일반 주문 규칙(상품−쿠폰−사용 포인트의 1% 버림, 배송비 제외)에 맞추는 의도를 정리했다. G-0213 기대값은 218P다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: 현재 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 total(배송비 포함) 기준 반올림.
- 일반 주문 적립은 `src/points/earn.js`의 `earnPoints`, 주문 생성 `src/orders/order.js:35`.
- `percentOf`(src/money.js)는 환불도 쓰므로 직접 바꾸지 말 것: docs/knowledge/points/percent-of-rounding.md
- 규칙: docs/knowledge/points/order-earn-points.md
- 테스트: `npm test` (node --test)
```

## 필요한 산출물

없음
