# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-2/relay-home-2/projects/shop-mate1-245413/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: f6cebd9e0d525694a5011682bba581b93472d403

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/earn-points-basis-excludes-shipping.md

```markdown
# 일반 주문 적립 포인트는 (상품 금액 - 쿠폰 - 사용 포인트)의 1%를 1P 단위로 버린다

- 종류: 사실
- 적용: `src/points/earn.js`
- 출처: 조사로 알아냄(고객센터 기준 사례 O-1042 한 건으로 추론), relay Work w-20261004-001, 2026-10-04

배송비는 적립 기준에서 뺀다. 예: O-1042는 28,270 - 3,000 - 1,500 = 23,770원 → 237P. 배송비 포함 26,770원 반올림은 268P로 틀린 값이다.
버림은 고객센터 값 1건으로 추론했다. 부분 환불 회수(`src/orders/refund.js`)는 아직 반올림이라 적립과 규칙이 다르다.
```

#### docs/knowledge/gift-points-shared-with-other-team.md

```markdown
# 선물하기 적립(`src/gift/gift-points.js`)은 다른 팀과 같이 보고 있어 함부로 바꾸지 않는다

- 종류: 규칙
- 적용: `src/gift/gift-points.js`, `src/gift/gift-order.js`
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

일반 주문 적립 버그를 고칠 때도 선물하기 적립 코드는 바꾸지 않는다. 같은 문제가 있어 보여도 다른 팀과 먼저 맞춘다.
공용 `percentOf`(`src/money.js`, 반올림)를 쓰므로 `percentOf`를 바꾸면 선물하기 적립도 달라진다. 일반 주문 쪽에서 내림이 필요하면 `earnPoints`에서만 처리한다.
이 Work 기준 선물하기는 `amounts.total`(배송비 포함) 반올림이라 일반 주문과 기준이 다르다.
```

#### docs/knowledge/saved-earned-points-never-recalculated.md

```markdown
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

- 종류: 규칙
- 적용: `src/orders/order.js`(`createOrder`가 `points.earned`를 저장), `src/orders/refund.js`, `src/format/receipt.js`
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

적립 계산식을 고쳐도 저장된 주문의 `points.earned`는 바꾸거나 재계산하지 않는다. 영수증, 전체 취소의 회수는 저장된 값을 읽는다.
적립 계산 수정은 새로 만드는 주문에만 적용된다. 예: 식을 고친 뒤에도 저장된 O-1077의 403P는 그대로여야 한다.
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.

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
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 현재 249P로 나온다. 같은 상품을 일반 주문으로 샀을 때와 같은 기준으로 계산해 고객센터 값인 218P가 나오게 바로잡는다.

## 비목표
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립되어 저장된 포인트는 바꾸거나 다시 계산하지 않는다.
- 공용 `percentOf`(`src/money.js`)는 바꾸지 않는다.
- 일반 주문 적립(`src/points/earn.js`)과 부분 환불 회수(`src/orders/refund.js`)는 바꾸지 않는다.

## 원하는 결과
- G-0213의 적립 예정 포인트가 218P다. (상품 24,860 - 쿠폰 2,000 - 사용 포인트 1,000 = 21,860원의 1%, 1P 단위 버림)
- 선물하기 주문의 적립 기준이 일반 주문과 같다. (배송비 제외)
- 금액 계산, 메시지 카드, 받는 사람 정보는 그대로다.

## 완료조건
- [ ] 재현 절차(G-0213 적립 예정 포인트 계산)가 더 이상 실패하지 않는다. 결과가 218P다.
- [ ] `npm test`가 통과한다.
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다.
- [ ] 선물하기 주문의 `amounts`(goods, coupon, shipping, pointsUsed, total)는 수정 전과 같다.
- [ ] 메시지 카드, 받는 사람 정보, `src/format/` 영수증 코드는 변경되지 않는다.
- [ ] 저장된 주문의 `points.earned`를 다시 계산하는 코드가 추가되지 않는다.
- [ ] 배송비가 있는 선물 주문과 없는 선물 주문 모두 적립이 일반 주문 `earnPoints`와 같은 값이라는 테스트가 있다.

## 제약
- (팀 지식 `docs/knowledge/gift-points-shared-with-other-team.md`) 선물하기 적립 코드(`src/gift/gift-points.js`, `src/gift/gift-order.js`)는 다른 팀과 같이 보고 있어 함부로 바꾸지 않는다. 같은 문제가 있어 보여도 다른 팀과 먼저 맞춘다. `percentOf`를 바꾸면 선물하기 적립도 달라지므로 바꾸지 않는다.
- (팀 지식 `docs/knowledge/saved-earned-points-never-recalculated.md`) 적립 계산 수정은 새로 만드는 주문에만 적용한다. 저장된 주문의 `points.earned`는 바꾸지 않는다.

## 추가 의견
- 요청은 `src/gift/gift-points.js` 쪽을 보라고 했다. 다른 팀과 합의가 됐는지 사람도 모른다. 일반 주문 쪽은 동료가 고객센터와 맞췄다고만 들었고, 그 동료는 휴가 중이다. 코드와 git 이력에는 합의 근거가 없다. 의도 승인 때 선물하기 적립 코드 수정 여부를 확인해 주세요.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-2/relay-home-2/projects/shop-mate1-245413/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:27 (사람 승인)
- [AI] 선물하기 적립 기준을 일반 주문과 같게(배송비 제외, 1P 버림) 맞추는 것을 목표로 한다 — 요청: 고객센터 218P, 일반 주문과 같아야 한다는 문의. 24,860-2,000-1,000=21,860원의 1%를 버리면 218P
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립 기준을 일반 주문과 같게(배송비 제외, 1P 버림) 맞추는 것을 목표로 한다"
    why: "요청: 고객센터 218P, 일반 주문과 같아야 한다는 문의. 24,860-2,000-1,000=21,860원의 1%를 버리면 218P"
    by: ai
assumptions:
  - "고객센터의 218P는 일반 주문과 같은 기준(상품-쿠폰-사용 포인트, 1% 버림)으로 계산한 값이다. 21,860원의 1%가 218.6이라 버림으로 맞는다"
rejected: []
open_questions:
  - "선물하기 적립 코드(src/gift/gift-points.js)를 바꾸는 것에 대해 다른 팀과 합의가 됐는가? 사람도 모르고 휴가 중인 동료에게 물을 수 없다. git 이력에도 근거가 없다"
intent_deviation: null
risks:
  - "다른 팀과 합의 없이 gift-points.js를 바꾸면 팀 지식 규칙을 어길 수 있다"
  - "선물하기 적립 기준을 배송비 제외로 바꾸는 것이 다른 팀의 의도와 다를 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
G-0213이 249P(배송비 포함 금액 반올림)로 나오는 문제를 일반 주문과 같은 기준으로 맞춰 218P가 되게 하는 의도 초안을 썼다. 선물하기 적립 코드는 다른 팀과 같이 보는 것이라, 수정 여부와 합의 확인을 open_questions에 남겼다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 배송비 포함 총액을 반올림한다. (참고용 가설이며 원인으로 확정되지 않음)
- `src/points/earn.js`: 일반 주문 기준 `earnPoints`. 13ac8af에서만 고쳐졌고 gift 쪽 이력은 init 이후 없다.
- `examples/G-0213.json`: 상품 24,860, 쿠폰 2,000, 사용 포인트 1,000.
- 참고 지식: `docs/knowledge/earn-points-basis-excludes-shipping.md`, `docs/knowledge/gift-points-shared-with-other-team.md`, `docs/knowledge/saved-earned-points-never-recalculated.md`
- 테스트: `npm test`. `test/gift.test.js`는 배송비 없는 경우만 확인한다.
```

## 필요한 산출물

없음
