# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-2/relay-home-2/projects/shop-mate1-245413/works/w-20261004-001/tasks/03-verify
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: f6cebd9e0d525694a5011682bba581b93472d403

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

- t-02 fix: 선물하기 적립은 일반 주문 earnPoints와 같은 기준(배송비 제외, 1P 버림)으로 바꿨다. 다른 팀과 합의는 확인되지 않았다 (사람이 gift-points.js만 수정하는 것을 선택)

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

## t-02 fix — 2026-10-04 05:28 (자동 승인)
- [사람] src/gift/gift-points.js만 수정해 giftPoints가 earnPoints를 호출하게 한다 — 원인이 그 파일이라 고치려면 불가피하다. 제약(다른 팀과 먼저 맞춤)에 닿아 사람에게 물었고 사람이 이 방향을 골랐다
```

## 누적 기각 목록

- t-02 fix: amounts 계산 수정: 금액은 일반 주문과 같게 계산되고 바꾸면 안 된다
- t-02 fix: gift-order.js에서 earnPoints 직접 호출: 제약 대상 파일을 하나 더 바꾸게 된다

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js만 수정해 giftPoints가 earnPoints를 호출하게 한다"
    why: "원인이 그 파일이라 고치려면 불가피하다. 제약(다른 팀과 먼저 맞춤)에 닿아 사람에게 물었고 사람이 이 방향을 골랐다"
    by: human
assumptions:
  - "고객센터 218P는 일반 주문과 같은 기준이라는 intake의 가정을 그대로 따른다"
rejected:
  - "amounts 계산 수정: 금액은 일반 주문과 같게 계산되고 바꾸면 안 된다"
  - "gift-order.js에서 earnPoints 직접 호출: 제약 대상 파일을 하나 더 바꾸게 된다"
open_questions: []
intent_deviation: null
risks:
  - "다른 팀과 합의 없이 선물하기 적립 기준(배송비 제외, 버림)이 바뀌었다. 사람이 이 수정을 선택했으나 합의는 확인되지 않았다"
  - "부분 환불 회수(refund.js)는 반올림이라 선물 주문 환불 때 적립과 회수가 1P 어긋날 수 있다. 이번엔 바꾸지 않았다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립은 일반 주문 earnPoints와 같은 기준(배송비 제외, 1P 버림)으로 바꿨다. 다른 팀과 합의는 확인되지 않았다 (사람이 gift-points.js만 수정하는 것을 선택)"
---
## 요약
G-0213 적립이 249P로 나온 원인은 giftPoints가 배송비 포함 total을 반올림한 것이었다. giftPoints가 earnPoints를 호출하게 고쳐 218P가 된다. 재현 테스트 2개를 추가했고 npm test 26개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js` (earnPoints 호출). 테스트: `test/gift.test.js` 마지막 두 개
- 수정 전 재현 테스트 실패, 수정 후 통과 확인함
- `src/orders/refund.js`는 반올림 회수라 선물 환불과 1P 차이 가능
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-2/relay-home-2/projects/shop-mate1-245413/works/w-20261004-001/tasks/02-fix/fix.md
