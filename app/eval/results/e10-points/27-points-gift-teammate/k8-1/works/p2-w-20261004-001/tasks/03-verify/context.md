# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-1/relay-home-2/projects/shop-mate1-eb1aad/works/w-20261004-001/tasks/03-verify
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: d82983cae426e78bb9a488da608dd605c468f5fd

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

#### docs/knowledge/points/earn-points-basis.md

```markdown
---
kind: rule
source: investigation
anchor: earnPoints
---
# 일반 주문 적립은 배송비를 뺀 금액의 1%를 1P 미만 버림으로 계산한다

## 규칙
- 기준 금액은 상품 - 쿠폰 - 사용 포인트(= `amounts.total - amounts.shipping`)이고, 여기에 `POINT_RATE_PERCENT`%를 곱해 1P 미만은 버린다 (`src/points/earn.js`). 예: O-1042는 23,770원 → 237P.
- 이미 저장된 `points.earned`는 다시 계산하지 않고 그대로 쓴다.
- 이 기준은 적립 안내 문서가 아니라 O-1042 한 건(237P)에서 역산해 정했다. 반올림이면 238P, 배송비 포함이면 268P라 맞지 않는다.

## 아직 규칙을 따르지 않는 곳
- `src/orders/refund.js`: 부분 환불의 `pointsRecovered`는 `percentOf(상품 환불액)` 반올림이라 위 기준과 다르다. 고칠지는 환불 기준 확인 후 정한다.
- `src/gift/gift-points.js`: 선물하기 적립은 배송비 포함·반올림이다. 다른 팀과 함께 볼 일이다 (`points/gift-points-ownership.md` 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/points/gift-points-ownership.md

```markdown
---
kind: rule
source: human
anchor: giftPoints
---
# 선물하기 적립(`giftPoints`)은 다른 팀과 같이 보고 있어 이 팀이 단독으로 고치지 않는다

## 규칙
- `src/gift/gift-points.js`는 다른 팀과 함께 보는 파일이다. 이 팀의 일에서 단독으로 수정하지 않는다.
- 일반 주문 적립 기준과 맞추는 일은 다른 팀과 함께 정한다 (일반 주문 기준은 `points/earn-points-basis.md` 참고).

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

- t-01 intake: 고칠 지식: docs/knowledge/points/gift-points-ownership.md — 사람이 이 파일이 다른 팀과 공유인 줄 몰랐고, G-0213 건은 리포트가 이 파일을 지목한 이 팀의 일이라 수정을 허용했다. 공유 규칙이 아직 유효한지 확인이 필요하다 (사람)
- t-02 fix: 선물하기 적립 `giftPoints`는 `earnPoints`에 위임해 일반 주문과 같은 기준이 되었다. earn-points-basis.md의 '아직 규칙을 따르지 않는 곳'에서 gift-points 항목을 지울 수 있다
- t-02 fix: 고칠 지식: docs/knowledge/points/gift-points-ownership.md — G-0213 건은 리포트가 지목한 이 팀의 일이라 사람이 수정을 허용했다 (사람)

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
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 일반 주문으로 같은 상품을 샀을 때와 같은 기준으로 계산되게 한다. 지금은 249P로 나오고, 고객센터 계산은 218P다.

## 비목표
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트(`points.earned`)는 다시 계산하지 않는다.
- 부분 환불(`src/orders/refund.js`)의 포인트 회수 기준은 이번에 다루지 않는다.

## 원하는 결과
G-0213의 적립 예정 포인트가 218P로 나온다. 선물하기 적립이 일반 주문 적립(`earnPoints`)과 같은 기준(배송비를 뺀 금액의 `POINT_RATE_PERCENT`%, 1P 미만 버림)을 따른다.

## 완료조건
- [ ] 재현 절차(G-0213의 적립 예정 포인트 계산)가 더 이상 실패하지 않는다: 218P가 나온다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] G-0213의 적립 예정 포인트가 일반 주문으로 같은 상품을 샀을 때와 같다
- [ ] 선물하기 적립 계산에 대한 테스트가 추가되어 G-0213의 218P를 확인한다
- [ ] `src/format/` 아래 파일과 선물 메시지·받는 사람 정보 처리가 바뀌지 않는다
- [ ] 이미 저장된 `points.earned`를 다시 계산하는 코드가 생기지 않는다

## 제약
- (팀 지식 `docs/knowledge/points/gift-points-ownership.md`) `src/gift/gift-points.js`는 다른 팀과 함께 보는 파일이라 이 팀이 단독으로 수정하지 않는다. 단, 사람이 이 버그는 리포트가 이 파일을 지목해 맡은 일이고 공유 파일인 줄 몰랐다며 이번 수정을 허용했다. 의도 승인에서 이 예외를 확인한다.
- (팀 지식 `docs/knowledge/points/earn-points-basis.md`) 일반 주문 적립 기준은 `amounts.total - amounts.shipping`에 `POINT_RATE_PERCENT`%를 곱해 1P 미만 버림이다.

## 추가 의견
- 요청이 관련 코드로 `src/gift/gift-points.js`를 지목했다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-1/relay-home-2/projects/shop-mate1-eb1aad/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:03 (사람 승인)
- [사람] 이번 수정에서 src/gift/gift-points.js 수정을 허용한다 — 팀 지식은 단독 수정 금지이나, 사람이 공유 파일인 줄 몰랐고 리포트가 이 파일을 지목한 자기 일이라며 수정을 허용했다
- [사람] src/format/ 불변, 이미 적립된 포인트 재계산 금지를 완료조건에 넣는다 — 요청 원문과 사람의 답

## t-02 fix — 2026-10-04 05:04 (자동 승인)
- [AI] giftPoints를 earnPoints에 위임한다 — intent: 일반 주문과 같은 기준. 기준을 복제하지 않아 어긋날 수 없다 (docs/knowledge/points/earn-points-basis.md)
- [AI] 공유 파일 src/gift/gift-points.js를 수정한다 — intake에서 사람이 허용함 (docs/knowledge/points/gift-points-ownership.md의 예외)
```

## 누적 기각 목록

없음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints를 earnPoints에 위임한다"
    why: "intent: 일반 주문과 같은 기준. 기준을 복제하지 않아 어긋날 수 없다 (docs/knowledge/points/earn-points-basis.md)"
    by: ai
  - what: "공유 파일 src/gift/gift-points.js를 수정한다"
    why: "intake에서 사람이 허용함 (docs/knowledge/points/gift-points-ownership.md의 예외)"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js는 다른 팀과 공유 파일이다. 다른 팀과의 합의는 확인되지 않았다"
  - "선물하기 적립이 배송비 제외·버림으로 바뀌어 다른 선물 주문의 적립도 달라진다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립 `giftPoints`는 `earnPoints`에 위임해 일반 주문과 같은 기준이 되었다. earn-points-basis.md의 '아직 규칙을 따르지 않는 곳'에서 gift-points 항목을 지울 수 있다"
  - "고칠 지식: docs/knowledge/points/gift-points-ownership.md — G-0213 건은 리포트가 지목한 이 팀의 일이라 사람이 수정을 허용했다 (사람)"
---
## 요약
G-0213 적립 예정이 249P였던 원인은 `giftPoints`가 배송비 포함 total을 반올림했기 때문이다. `earnPoints`에 위임해 218P가 나오게 고치고 테스트를 추가했다. `npm test` 23개 통과.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints` 위임
- `test/gift.test.js`: G-0213 218P 테스트 (수정 전 249로 실패 확인)
- `src/format/`, `points.earned` 재계산 코드는 건드리지 않음
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-1/relay-home-2/projects/shop-mate1-eb1aad/works/w-20261004-001/tasks/02-fix/fix.md
