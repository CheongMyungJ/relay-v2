# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-5/relay-home-2/projects/shop-mate1-30e229/works/w-20261004-001/tasks/03-verify
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 45f5e22812e6a5e4e46794d8d4d65e061269b0df

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/points/earn-points-formula.md

```markdown
---
kind: rule
source: investigation
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 결제 금액의 1%를 1P 미만 버림한 값이다

## 규칙
- 적립 포인트 = floor((결제 금액 `amounts.total` − 배송비 `amounts.shipping`) × `POINT_RATE_PERCENT` / 100). 고객센터 기준 O-1042는 237P (23770 × 1% = 237.7 → 237).
- 정책 문서는 없다. 237P를 고객센터 값에서 거꾸로 맞춘 식이므로, 다른 주문의 정답으로는 검증되지 않았다.
- 공유 도우미 `percentOf`(`src/money.js`)는 반올림이라 적립에 쓰지 않는다. 선물하기와 공유하므로 바꾸지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/orders/refund.js: 부분 환불의 `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`(상품 금액 기준, 반올림)라 적립 식과 다르다. 적립보다 1P 더 회수할 수 있다. 환불 정책 확인 후 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/points/gift-points-hands-off.md

```markdown
---
kind: rule
source: human
anchor: giftPoints
---
# 선물하기 적립(`giftPoints`)은 다른 팀과 협의 전에는 포인트 관련 일에서도 바꾸지 않는다

## 규칙
- `src/gift/gift-points.js`는 다른 팀과 함께 보고 있어 포인트 적립 수정 일에서도 손대지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: `earnPoints`의 옛 식(배송비 포함, 반올림)을 그대로 써서 같은 과다 적립이 있을 수 있다. 협의 후 `docs/knowledge/points/earn-points-formula.md`의 식에 맞출지 정한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/points/stored-points-not-recalculated.md

```markdown
---
kind: rule
source: human
---
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

## 규칙
- 주문의 `points.earned`는 주문을 만들 때 한 번만 계산해 저장한다. 계산식이 바뀌어도 이미 적립된 주문은 다시 계산하지 않는다.
- 영수증, 환불(전체 취소), 포인트 내역은 저장된 값을 그대로 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

### 지식 남기기 (이 단계에서 할 일)

공통 종료 절차의 커밋 전에, 이 Work에서 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에 남기고 코드와 함께 커밋한다. 팀이 PR로 함께 보고, 다음 일의 에이전트가 읽는다. 재료는 아래 지식 후보, Work 요청 원문(`request.md`), intent의 `비목표`와 `제약`, 결정 로그의 사람 결정(`by: human`), 이 task에서 사람이 한 말이다.

무엇을 남기나:

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.
- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.
- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다. 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다.

기존 항목을 고칠지 새로 만들지 (먼저 위 "항목"을 본다):

- 남길 것마다 위 항목 가운데 같은 대상(같은 규칙, 같은 값, 같은 코드 이름)을 다루는 것이 있는지 먼저 찾는다. 있으면 그 파일을 **같은 경로에서** 고친다. 이름이 달라도 대상이 같으면 같은 항목이다. 맞는 것이 없을 때만 새 파일을 만든다.
- 사람의 지금 말이 기존 항목과 어긋나면(값이나 규칙이 바뀌었으면) 그 항목을 반드시 고친다. 새 파일을 따로 만들어 옛 항목을 그대로 두지 않는다. `## 바뀐 이력`에 "<날짜> <옛 값> → <새 값> (Work <id>, 사람이 알려 줌)"을 한 줄 더한다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 이 worktree에 파일이 없다. 고칠 때는 위에 보인 앞 내용을 모두 살려 같은 경로에 새 형식으로 쓴다(머지하면 이 Work의 파일이 남는다). 고칠 것이 없으면 그 파일을 만들지 않는다.
- 한 사실은 한 곳에만 쓴다. 값이나 규칙은 그것을 다루는 항목 한 곳에만 적고, 다른 항목에서는 "<경로> 참고"로 가리킨다. 다른 항목에 곁들여 적은 값은 바뀔 때 함께 고쳐지지 않는다.

파일 형식 (앱이 확인한다. 틀리면 되돌아온다):

- 경로는 `docs/knowledge/<영역>/<이름>.md` 또는 `docs/knowledge/<이름>.md`. 영역과 이름은 영어 소문자, 숫자, `-` (예: `shipping/free-shipping-threshold.md`).
- `kind: rule`(이래야 한다)이면 본문 절은 `## 규칙`, 그 밖(`fact`, `history`, `pitfall`)은 `## 내용`이다.
- `## 규칙`에는 이래야 하는 것만 쓴다. 지금 코드가 규칙을 따르지 않는 곳(고칠 곳)은 `## 아직 규칙을 따르지 않는 곳`에 쓴다. "지금 코드는 ~를 쓴다"를 규칙처럼 쓰면 다음 사람이 그것을 규칙으로 읽는다.
- 규칙이 코드 이름(상수, 함수)에 붙어 있으면 머리글의 `anchor`에 그 이름을 적는다. 같은 `anchor`를 가진 항목이 둘이면 앱이 되돌린다.

```markdown
---
kind: rule            # rule | fact | history | pitfall
source: human         # human (사람이 알려 줌) | investigation (조사로 알아냄)
anchor: SOME_CONSTANT # 규칙이 붙은 코드 이름. 없으면 이 줄을 뺀다
---
# <한 줄 제목: 규칙이나 사실>

## 규칙
- <이래야 하는 것. 예와 수치>

## 아직 규칙을 따르지 않는 곳
- <경로>: <지금 어떻게 되어 있어 고쳐야 하나> (없으면 이 절을 뺀다)

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

handoff에 적는 줄 (앱이 확인한다):

- `## 요약` 끝에 바꾼 지식 파일마다 한 줄: 새로 만든 파일은 `새 지식: <경로> — <맞는 기존 항목이 없는 까닭>`, 이미 있던 파일(위 항목에 보인 것)을 고쳤으면 `고친 지식: <경로> — <무엇이 바뀌었나>`.
- 바꾼 지식이 없으면 `남긴 지식: 없음 (까닭)`.

#### 앞 task들의 지식 후보

- t-02 fix: 선물 주문의 적립은 gift-order.js에서 earnPoints를 호출한다. giftPoints는 더 이상 주문 생성에 쓰이지 않지만 협의 전까지 남겨 둔다

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
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 249P로 나오는데, 고객센터 기준 218P여야 한다는 문의를 바로잡는다. 같은 상품을 일반 주문으로 샀을 때와 왜 다른지도 확인해 알린다.

## 비목표
- `src/gift/gift-points.js`(`giftPoints`)는 수정하지 않는다. 다른 팀과 협의 전이다.
- 선물 메시지 카드와 받는 사람 정보는 바꾸지 않는다.
- 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트는 다시 계산하지 않는다.
- 부분 환불의 `pointsRecovered` 식(`src/orders/refund.js`)은 이번에 고치지 않는다.

## 원하는 결과
- 선물하기 주문 G-0213의 적립 예정 포인트가 218P로 나온다.
- 일반 주문과 선물하기 주문의 적립 포인트가 달랐던 이유가 설명돼 있다.
- 수정은 `giftPoints`를 건드리지 않고 선물 주문을 만드는 쪽(호출부)에서 한다. 사람이 정한 범위다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (G-0213의 적립 예정 포인트가 249P가 아니라 218P다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `src/gift/gift-points.js`가 변경되지 않았다
- [ ] 선물 메시지, 받는 사람 정보, 영수증 글자(`src/format/`) 출력이 변경 전과 같다
- [ ] 이미 저장된 주문의 `points.earned`를 다시 계산하는 코드가 추가되지 않았다
- [ ] 일반 주문과 선물 주문의 적립 포인트가 달랐던 이유가 fix 결과에 적혀 있다

## 제약
- (팀 지식 `docs/knowledge/points/gift-points-hands-off.md`) `src/gift/gift-points.js`는 다른 팀과 함께 보고 있어 포인트 적립 수정 일에서도 손대지 않는다.
- (팀 지식 `docs/knowledge/points/stored-points-not-recalculated.md`) 주문의 `points.earned`는 주문 생성 때 한 번만 계산해 저장한다. 이미 적립된 주문은 다시 계산하지 않는다.
- (팀 지식 `docs/knowledge/points/earn-points-formula.md`) `percentOf`(`src/money.js`)는 선물하기와 공유하므로 바꾸지 않는다.

## 추가 의견
- 요청에 "관련 코드는 `src/gift/gift-points.js`"라고 돼 있으나, 위 팀 규칙에 따라 수정 대상에서 뺐다. 호출부에서 해결하기로 사람이 골랐다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-5/relay-home-2/projects/shop-mate1-30e229/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:37 (사람 승인)
- [사람] src/gift/gift-points.js는 그대로 두고 호출부(src/gift/gift-order.js)에서 해결한다 — 팀 규칙(gift-points-hands-off)상 협의 전 수정 금지. 사람이 이 범위를 골랐다

## t-02 fix — 2026-10-04 06:38 (자동 승인)
- [AI] 호출부 gift-order.js에서 earnPoints를 쓰도록 바꾼다 — intent의 범위와 팀 규칙 docs/knowledge/points/gift-points-hands-off.md, earn-points-formula.md
```

## 누적 기각 목록

- t-01 intake: gift-points.js 직접 수정: 팀 규칙 위반, 사람이 선택하지 않음
- t-02 fix: 금액(amounts) 계산 차이: 선물 주문도 orderAmounts를 그대로 쓴다

## 직전 handoff (t-02 fix)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "호출부 gift-order.js에서 earnPoints를 쓰도록 바꾼다"
    why: "intent의 범위와 팀 규칙 docs/knowledge/points/gift-points-hands-off.md, earn-points-formula.md"
    by: ai
assumptions:
  - "218P는 earnPoints 식으로 맞춘 고객센터 값이라 다른 주문으로는 검증되지 않았다"
rejected:
  - "금액(amounts) 계산 차이: 선물 주문도 orderAmounts를 그대로 쓴다"
open_questions: []
intent_deviation: null
risks:
  - "giftPoints는 src/index.js에서 여전히 export되며 옛 식이다. 협의 후 정리 필요"
  - "이미 옛 식으로 저장된 선물 주문의 points.earned는 다시 계산하지 않았다"
recommended_next: null
knowledge_candidates:
  - "선물 주문의 적립은 gift-order.js에서 earnPoints를 호출한다. giftPoints는 더 이상 주문 생성에 쓰이지 않지만 협의 전까지 남겨 둔다"
---
## 요약
G-0213이 249P로 나온 것은 선물 주문이 옛 식 giftPoints(배송비 포함, 반올림)를 썼기 때문이다. gift-order.js가 earnPoints를 쓰게 해 218P가 나온다. 재현 테스트를 추가했고 npm test 25개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-order.js:36`. `src/gift/gift-points.js`는 변경 없음.
- 테스트: `test/gift.test.js` 마지막 케이스, `npm test`.
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-5/relay-home-2/projects/shop-mate1-30e229/works/w-20261004-001/tasks/02-fix/fix.md
