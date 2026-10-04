# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-5/relay-home-2/projects/shop-mate1-0989a7/works/w-20261004-001/tasks/03-verify
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 071a409a523f24935776050ac0d36ddbc4d1448e

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/gift-points-hands-off.md

```markdown
# 선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보고 있어 손대지 않는다

- 종류: 규칙
- 적용: src/gift/gift-points.js, 공유 함수 percentOf(src/money.js)
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

선물하기 적립은 다른 팀과 함께 보는 중이라 일반 주문 수정에서 바꾸지 않는다.
`percentOf`는 gift-points.js와 refund.js가 공유하므로 고치면 선물하기 적립도 바뀐다. 일반 주문은 earn.js 안에서만 계산한다.
(선물하기는 지금 배송비 포함·반올림 기준이 남아 있다. 바꾸려면 그 팀과 먼저 정한다.)
```

#### docs/knowledge/no-recalc-saved-points.md

```markdown
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

- 종류: 규칙
- 적용: src/orders/order.js, src/orders/refund.js, 포인트 적립 계산 전반
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

적립 계산 규칙을 바꿔도 이미 저장된 주문의 `points.earned`는 재계산하거나 바꾸지 않는다.
영수증·환불·포인트 내역은 주문을 만들 때 저장한 값을 쓴다. 새 규칙은 새로 만드는 주문에만 적용된다.
```

#### docs/knowledge/receipt-text-unchanged.md

```markdown
# 영수증 글자(src/format/)는 앱과 메일이 그대로 보여 주므로 바뀌면 안 된다

- 종류: 규칙
- 적용: src/format/
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

영수증 출력 문자열은 앱과 메일이 그대로 보여 준다. 계산 버그를 고칠 때도 형식 코드는 건드리지 않고 계산 쪽에서 고친다.
```

#### docs/knowledge/regular-order-points-rule.md

```markdown
# 일반 주문 적립은 배송비를 뺀 결제 금액에 적립률을 곱하고 원 단위로 버린다

- 종류: 규칙
- 적용: src/points/earn.js (일반 주문 O-), POINT_RATE_PERCENT(src/config.js)
- 출처: 조사로 알아냄(고객센터 기준 237P에서 역산), relay Work w-20261004-001, 2026-10-04

적립 = floor((상품 - 쿠폰 - 사용 포인트) × 적립률 / 100). 배송비는 뺀다.
예: O-1042는 23,770원 × 1% = 237.7 → 237P. 배송비 포함 26,770원 반올림은 268P로 틀리다.
배송비만 빼고 반올림하면 238, 포함하고 버림하면 267이라 둘 다 필요하다.
환불 회수(src/orders/refund.js의 부분 환불)는 아직 반올림이라 1P 어긋날 수 있다.
```

### 지식 남기기 (이 단계에서 할 일)

공통 종료 절차의 커밋 전에, 이 Work에서 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에 남기고 코드와 함께 커밋한다. 팀이 PR로 함께 보고, 다음 일의 에이전트가 읽는다. 재료는 아래 지식 후보, Work 요청 원문(`request.md`), intent의 `비목표`와 `제약`, 결정 로그의 사람 결정(`by: human`), 이 task에서 사람이 한 말이다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.
- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.
- 규칙과 사실, 그 까닭을 쓴다. 코드의 지금 모양(어느 함수가 무엇을 쓰는지)은 이 Work가 바꿨을 수 있고 기준 브랜치에는 아직 없을 수 있으니 "관련 위치"로만 적고 "이렇게 되어 있다"고 쓰지 않는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다(다음 일이 같은 것을 다시 묻게 만든다).
- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다.
- 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다. 규칙이 여럿이면(예: 계산 규칙과 적용 순서) 항목을 나눈다.
- 한 항목에 파일 하나. 파일 이름은 내용을 나타내는 영어 소문자와 `-` (예: `no-cache-external-api.md`). 같은 내용의 파일이 이미 있으면 새로 만들지 말고 그 파일을 고친다.
- 무엇이 맞고 무엇이 틀린지, 예와 수치를 적는다. 다음 사람이 이 파일만 읽고 따를 수 있어야 한다.
- 위 항목 가운데 "기준 브랜치에는 아직 없다"고 적힌 것은 이 worktree에 파일이 없다. 그 항목을 고쳐야 할 때만 같은 경로에 앞 내용을 모두 살려 고친 파일을 쓰고(머지하면 이 Work의 파일이 남는다), 고칠 것이 없으면 그 파일을 만들지 않는다.
- 남긴 파일은 handoff의 `## 요약` 끝에 "남긴 지식: <경로>"로 적는다. 남길 것이 없으면 "남긴 지식: 없음 (까닭)"으로 적는다. 앱이 이 줄을 확인한다.

파일 형식:

```markdown
# <한 줄 제목: 규칙이나 사실>

- 종류: 규칙 | 사실 | 이력 | 실패 유형
- 적용: <관련 경로나 영역>
- 출처: <사람이 알려 줌 / 조사로 알아냄>, relay Work w-20261004-001, 2026-10-04

<본문: 5줄 안팎>
```

#### 앞 task들의 지식 후보

- t-01 intake: 선물하기 적립 계산(src/gift/gift-points.js)을 일반 주문 기준(배송비 제외, 원 단위 버림)으로 맞추는 것은 사람이 이번 Work에서 허용했다. 다른 팀과의 합의 여부는 사람도 모른다 (사람)

## 선택 가능한 다음 단계

- 기본 다음 단계: Work 완료
- 이전 단계: intake (의도 정리), fix (원인 분석과 수정)

## intent (버전 1)

```markdown
---
schema_version: 1
version: 1
type: bugfix
---
## 목표
선물하기 주문의 적립 예정 포인트를 일반 주문과 같은 기준으로 계산한다. 고객센터 기준으로 G-0213은 218P여야 하는데 지금은 249P로 나온다.

## 비목표
- `percentOf`(src/money.js)와 일반 주문 적립(src/points/earn.js)은 바꾸지 않는다.
- 환불 회수(src/orders/refund.js)의 반올림은 고치지 않는다.
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(src/format/)는 바꾸지 않는다.
- 이미 저장된 주문의 `points.earned`는 재계산하거나 바꾸지 않는다.

## 원하는 결과
선물하기 적립이 일반 주문 기준(배송비를 뺀 결제 금액 × 적립률, 원 단위 버림)으로 계산된다. 변경은 src/gift/gift-points.js 안에서만 한다. 기준은 일반 주문 쪽 코드(동료가 고객센터와 맞춰 둔 것)다. 새로 만드는 선물 주문부터 적용된다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (examples/G-0213.json으로 선물 주문을 만들면 적립이 218P)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 일반 주문 적립 결과(earnPoints)와 같은 상품·금액의 선물 주문 적립 결과가 같다
- [ ] src/gift/gift-points.js 외의 소스 파일(src/money.js, src/format/ 등)은 바뀌지 않는다
- [ ] 선물 메시지와 받는 사람 정보, 영수증 출력은 수정 전과 같다

## 제약
- (팀 지식 docs/knowledge/gift-points-hands-off.md) 선물하기 적립은 다른 팀과 같이 보는 중이고, `percentOf`는 gift-points.js와 refund.js가 공유하므로 고치지 않는다. 사람이 이번 Work에서 gift-points.js 수정을 허용했다.
- (팀 지식 docs/knowledge/no-recalc-saved-points.md) 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다.
- (팀 지식 docs/knowledge/receipt-text-unchanged.md) 형식 코드(src/format/)는 건드리지 않고 계산 쪽에서 고친다.

## 추가 의견
- (사람 추정, 확인 안 됨) src/gift/gift-points.js 쪽 문제로 보인다.
- 다른 팀과 선물하기 적립 변경을 합의했는지는 사람도 모른다. 사람이 수정을 허용했다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-5/relay-home-2/projects/shop-mate1-0989a7/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:39 (사람 승인)
- [사람] 이번 Work에서 src/gift/gift-points.js 수정을 허용한다. 다른 파일은 건드리지 않는다 — 팀 지식은 손대지 말라고 하지만, 사람이 이 일을 gift-points.js 수정으로 맡았다고 명시적으로 허용함
- [사람] 적립 기준은 일반 주문 코드(earn.js)를 따른다. G-0213은 218P — 사람이 적립 규칙을 자세히 모르고, 동료가 고객센터와 맞춘 일반 주문 코드를 기준으로 하라고 함

## t-02 fix — 2026-10-04 06:40 (자동 승인)
- [AI] giftPoints가 earnPoints를 호출해 일반 주문과 계산을 공유한다 — 완료조건: 같은 금액이면 일반 주문과 선물 적립이 같아야 한다. 변경이 gift-points.js 안에 머문다
- [AI] percentOf와 earn.js, refund.js는 건드리지 않는다 — 팀 지식 docs/knowledge/gift-points-hands-off.md, 비목표
```

## 누적 기각 목록

없음

## 직전 handoff (t-02 fix)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 호출해 일반 주문과 계산을 공유한다"
    why: "완료조건: 같은 금액이면 일반 주문과 선물 적립이 같아야 한다. 변경이 gift-points.js 안에 머문다"
    by: ai
  - what: "percentOf와 earn.js, refund.js는 건드리지 않는다"
    why: "팀 지식 docs/knowledge/gift-points-hands-off.md, 비목표"
    by: ai
assumptions:
  - "다른 팀과의 합의 여부는 확인되지 않았고, 사람의 허용에 따라 진행했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립은 다른 팀이 같이 보는 중이라 그 팀의 작업과 충돌할 수 있다"
  - "선물 주문 환불 회수(refund.js)는 반올림이라 1P 어긋날 수 있다. 범위 밖"
  - "earn.js가 바뀌면 선물 적립도 함께 바뀐다"
recommended_next: null
knowledge_candidates: []
---
## 요약
`giftPoints`가 배송비를 포함하고 반올림해 G-0213이 249P로 나오던 것을, `earnPoints`를 호출하게 바꿔 218P로 고쳤다. 재현 테스트를 추가했고 `npm test`는 23개 통과다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: 전체가 `earnPoints(order)` 호출
- `test/gift.test.js`: G-0213 테스트 추가 (수정 전 249로 실패 확인)
- 변경 소스 파일은 gift-points.js 하나. 이미 저장된 주문은 재계산하지 않음
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-5/relay-home-2/projects/shop-mate1-0989a7/works/w-20261004-001/tasks/02-fix/fix.md
