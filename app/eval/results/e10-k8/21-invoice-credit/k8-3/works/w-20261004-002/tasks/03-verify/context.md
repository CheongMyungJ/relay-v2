# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/21-invoice-credit-k8-3/relay-home/projects/billing-e25929/works/w-20261004-002/tasks/03-verify
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: 9cf949111e3d7e8d4095f847fd91948afba2dc78

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/invoice/issued-invoice-totals-frozen.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고 저장된 totals를 쓴다

## 규칙
- 발행된 청구서의 금액은 발행 시 저장된 `totals`를 그대로 쓴다. 계산 방식(예: 부가세 절사)이 바뀌어도 다시 계산하지 않는다.
- 계산 방식을 바꾸면 새로 계산하는 청구서부터 값이 바뀐다. CSV, 분개, 월별 요약도 `invoiceTotals`를 거치므로 같다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
anchor: lineVatSum
---
# 부가세는 과세 줄마다 원 미만 절사해 합산한다

## 규칙
- 회계팀 방식: 과세 줄마다 할인 후 공급가액(net)의 10%를 원 미만 절사하고, 그 값을 합산한다. 합계에 한 번 반올림하지 않는다.
- 예: `examples/INV-2031.json`은 536+633+325+837+310 = 부가세 2,641원, 합계 29,079원이다.
- 면세 줄은 부가세가 없고, 영세율(`zeroRated`)이면 부가세 0이다.

## 아직 규칙을 따르지 않는 곳
- src/invoice/credit-note.js `creditTotals`: 부가세를 합계에 한 번 `Math.round`한다. 청구서와 1~3원 어긋날 수 있다. 사람이 이번 Work에서는 청구서만 고치기로 했다.

## 바뀐 이력
- 2026-10-04 처음 남김. 청구서 `computeTotals`(src/invoice/total.js)를 줄별 절사로 바꿈 (Work w-20261004-001, 사람이 알려 줌)
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
- 2026-10-04 처음 남김 (Work w-20261004-002)
```

handoff에 적는 줄 (앱이 확인한다):

- `## 요약` 끝에 바꾼 지식 파일마다 한 줄: 새로 만든 파일은 `새 지식: <경로> — <맞는 기존 항목이 없는 까닭>`, 이미 있던 파일(위 항목에 보인 것)을 고쳤으면 `고친 지식: <경로> — <무엇이 바뀌었나>`.
- 바꾼 지식이 없으면 `남긴 지식: 없음 (까닭)`.

#### 앞 task들의 지식 후보

- t-01 intake: 반품 전표(src/invoice/credit-note.js creditTotals)도 부가세는 청구서와 같이 과세 줄마다 절사해 합산한다. 회계팀 기준 CN-0112 환불 합계는 19,180원 (사람)
- t-01 intake: 이미 저장된 반품 전표 totals는 새 계산 방식이 나와도 다시 계산하지 않는다 (사람)
- t-02 fix: 반품 전표 creditTotals도 부가세를 과세 줄마다 절사해 합산하도록 고쳤다. 이제 vat-per-line-floor.md의 '아직 규칙을 따르지 않는 곳'에서 뺀다. CN-0112 합계 19,180원, 부가세 1,742원

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
반품 전표(`src/invoice/credit-note.js`)의 환불 금액이 회계팀 계산과 맞지 않는 문제를 바로잡는다. 회계팀 기준으로 CN-0112(청구서 INV-2047의 반품)의 환불 합계는 19,180원인데, 현재 전표는 19,182원으로 2원 많다.

## 비목표
- 이미 발행·저장된 반품 전표의 `totals`는 다시 계산하거나 고치지 않는다. 새로 계산하는 전표부터 바뀐다.
- 청구서 계산(`src/invoice/total.js`)은 바꾸지 않는다.

## 원하는 결과
- `examples/CN-0112.json`(청구서 `examples/INV-2047.json`)으로 반품 전표를 새로 만들면 환불 합계가 19,180원이다.
- 반품 전표의 부가세가 청구서와 같은 방식(과세 줄마다 할인 후 공급가액의 10%를 원 미만 절사해 합산)으로 계산된다. 면세 줄은 부가세가 없고 영세율이면 0이다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] CN-0112 요청과 INV-2047로 `createCreditNote`를 호출하면 `totals.total`이 19,180이다
- [ ] 면세 줄이 있거나 `zeroRated`인 반품 전표의 부가세가 위 규칙대로 계산된다는 테스트가 있다
- [ ] 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 저장된 값을 그대로 돌려준다

## 제약
- (팀 지식 docs/knowledge/invoice/vat-per-line-floor.md) 부가세는 과세 줄마다 할인 후 공급가액(net)의 10%를 원 미만 절사해 합산한다. 합계에 한 번 반올림하지 않는다.
- (팀 지식 docs/knowledge/invoice/issued-invoice-totals-frozen.md) 발행되어 저장된 totals는 계산 방식이 바뀌어도 재계산하지 않는다.

## 추가 의견
- 요청 원문: 회계팀이 10월 반품 전표를 대조하다 환불 금액이 몇 원씩 어긋난다고 연락함.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/21-invoice-credit-k8-3/relay-home/projects/billing-e25929/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:28 (사람 승인)
- [사람] 기대 금액은 팀 지식의 줄별 절사 규칙에 맞춘 값(CN-0112 합계 19,180원)으로 한다 — 사람이 회계팀 계산 CN-0112 환불 합계 19,180원이라고 알려 줌
- [사람] 이미 저장된 반품 전표 totals는 고치지 않고 새 계산부터 적용한다 — 사람이 '새 계산부터 적용'을 선택. 저장된 totals 고정 규칙과 같다

## t-02 fix — 2026-10-04 05:29 (자동 승인)
- [AI] 반품 전표 부가세를 줄마다 Math.floor 후 합산으로 바꾸고 청구서(total.js)는 건드리지 않는다 — docs/knowledge/invoice/vat-per-line-floor.md 규칙과 intent 비목표
- [AI] 저장된 totals는 재계산하지 않는다(creditNoteTotals 그대로) — docs/knowledge/invoice/issued-invoice-totals-frozen.md
```

## 누적 기각 목록

- t-02 fix: returnedDiscount 오차: 공급가액 합은 이미 맞고 부가세만 2원 차이

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 줄마다 Math.floor 후 합산으로 바꾸고 청구서(total.js)는 건드리지 않는다"
    why: "docs/knowledge/invoice/vat-per-line-floor.md 규칙과 intent 비목표"
    by: ai
  - what: "저장된 totals는 재계산하지 않는다(creditNoteTotals 그대로)"
    why: "docs/knowledge/invoice/issued-invoice-totals-frozen.md"
    by: ai
assumptions:
  - "net이 음수인 줄은 없다고 보았다(Math.floor는 음수에서 0 쪽이 아니라 아래로 내림)"
rejected:
  - "returnedDiscount 오차: 공급가액 합은 이미 맞고 부가세만 2원 차이"
open_questions: []
intent_deviation: null
risks:
  - "청구서 computeTotals(src/invoice/total.js)는 여전히 합계에 Math.round 한다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "반품 전표 creditTotals도 부가세를 과세 줄마다 절사해 합산하도록 고쳤다. 이제 vat-per-line-floor.md의 '아직 규칙을 따르지 않는 곳'에서 뺀다. CN-0112 합계 19,180원, 부가세 1,742원"
---
## 요약
`creditTotals`가 부가세를 합계에 한 번 반올림해 CN-0112가 19,182원이었다. 줄별 절사 합산으로 고쳐 19,180원이 된다. 재현 테스트 3개를 추가했고 `npm test` 49개 모두 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals` vat 줄.
- 테스트: `test/credit-note.test.js` 끝의 3개. 수정 전 2개 실패 확인.
- 이 브랜치의 `src/invoice/total.js`는 아직 Math.round(앞 Work 머지 대기). 비목표라 건드리지 않음.
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-k8/21-invoice-credit-k8-3/relay-home/projects/billing-e25929/works/w-20261004-002/tasks/02-fix/fix.md
