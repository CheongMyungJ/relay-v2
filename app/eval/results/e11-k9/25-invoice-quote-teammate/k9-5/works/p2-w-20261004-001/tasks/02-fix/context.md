# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e11-k9/25-invoice-quote-teammate-k9-5/relay-home-2/projects/billing-mate1-def2ab/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 9b8527d52ed526bf6560f459a5c996f42e0fc1e4

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. "범위에서 뺌"이라고 적혀 있어도 금지가 아니라 그때 Work의 범위였다. 이번 요청이 그 코드를 고치는 일이면 규칙대로 고친다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/billing/credit-note-stored-amounts.md

```markdown
---
kind: rule
source: human
anchor: returnedDiscount
---
# 반품 전표: 저장 금액은 다시 계산하지 않고, 금액 할인은 수량 비율로 나눈다

## 규칙
- 이미 발행된 청구서와 이미 만든 반품 전표는 다시 계산하지 않고 저장된 `totals`를 그대로 쓴다.
- 금액 할인 줄을 일부만 반품할 때 할인을 수량 비율로 나누는 `returnedDiscount`의 방식은 회계팀과 맞춘 것이다.
- `src/format/`의 출력 형식은 금액 계산을 고치면서 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-002)
```

#### docs/knowledge/billing/vat-per-line-floor.md

```markdown
---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 할인된 줄 금액에 줄마다 원 단위 버림으로 계산해 합한다

## 규칙
- 할인은 부가세 전에 품목 줄마다 적용하고, 부가세는 할인된 줄 금액(과세 줄만)에 매긴다.
- 줄마다 `Math.floor(net * 10 / 100)`(원 단위 버림)으로 계산하고, 청구서 부가세는 줄별 부가세의 합이다. 합계에서 다시 반올림하지 않는다.
- 청구서(`computeTotals`), 견적(`quoteTotals`), 반품 전표(`creditTotals`) 모두 `src/invoice/total.js`의 `lineVat`/`sumLineVat`을 쓴다. 새 문서 종류도 같은 함수를 쓴다.
- 반품 전표는 돌려받는 품목 줄마다 같은 방식으로 계산한다.
- 영세율(`zeroRated`)과 면세 줄의 부가세는 0이다.
- 예: INV-2031 공급가액 26,438원, 부가세 2,641원, 합계 29,079원 (회계팀 합계와 일치).
- 예: CN-0112(INV-2047 반품) 공급가액 17,438원, 부가세 1,742원, 환불 합계 19,180원.

## 아직 규칙을 따르지 않는 곳
- src/invoice/credit-note.js: `creditTotals`가 `lineVat`/`sumLineVat` 대신 줄별 `Math.floor`를 직접 계산한다. 앞 Work(w-20261004-001) 머지 전에 `total.js`에 공용 함수가 없어서 그렇게 했다. 머지 뒤 공용 함수로 바꾼다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
- 2026-10-04 반품 전표 `creditTotals`를 줄별 원 단위 버림으로 고침 (Work w-20261004-002)
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.
- 사람의 지금 말이 위 항목과 어긋나면(값이나 규칙이 바뀌었으면) "고칠 지식: <경로> — <새 내용> (사람)"으로 후보에 적는다. verify가 그 항목을 고친다.
- 사람이 이번 Work의 범위로 한 말("이번엔 손대지 마라", "다음에 따로 고친다", "이번 범위가 아니다")은 규칙이 아니다. "~는 수정하지 않는다" 같은 규칙으로 남기지 않는다. 사람이 "앞으로도 늘"처럼 오래 지킬 것으로 말했을 때만 규칙이다. 후보에는 "아직 규칙을 따르지 않음: <경로> — <지금 상태>, 사람이 이번 범위에서 뺌 (사람)"으로 적는다.

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
견적서 Q-0457(`examples/Q-0457.json`)의 합계 문의를 정리한다. 경리 합계는 56,278원이다. 요청에는 우리 합계가 56,280원이라고 되어 있으나 출처를 알 수 없고(영업팀 확인 불가), 견적 계산 코드는 지금 56,278원을 낸다. 따라서 견적 합계가 경리와 같음을 테스트로 고정하고, 현재 깨져 있는 `npm test`를 통과시킨다.

## 비목표
- 견적 번호 형식(Q-0000)과 유효 기간 계산은 바꾸지 않는다. 영업 시스템이 그대로 읽는다.
- `src/format/`의 출력 형식은 바꾸지 않는다.
- 견적 합계의 부가세 규칙(줄별 원 단위 버림)은 바꾸지 않는다.
- 56,280원이 나오는 경로를 코드에서 찾지 못하면 그 경로를 지어내 고치지 않는다.

## 원하는 결과
Q-0457의 견적 합계가 공급가액 52,691원, 부가세 3,587원, 합계 56,278원으로 나오고 이를 테스트가 확인한다. 반품 전표 코드의 오류 때문에 실패하던 테스트도 통과한다.

## 완료조건
- [ ] 재현 절차(`node src/cli.js examples/Q-0457.json`)가 합계 56,278원을 낸다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] Q-0457 합계가 공급가액 52,691원, 부가세 3,587원, 합계 56,278원임을 확인하는 테스트가 통과한다
- [ ] 견적 번호 형식과 유효 기간 계산(`createQuote`의 번호 검사, `quoteValidUntil`) 결과가 수정 전과 같다
- [ ] `creditTotals`가 `lineVat`/`sumLineVat`을 쓰고, CN-0112 예시(공급가액 17,438원, 부가세 1,742원, 환불 합계 19,180원)가 나온다

## 제약
- (팀 지식 `docs/knowledge/billing/vat-per-line-floor.md`) 부가세는 할인된 줄 금액에 줄마다 `Math.floor(net * 10 / 100)`로 계산해 합하고, 청구서·견적·반품 전표 모두 `src/invoice/total.js`의 `lineVat`/`sumLineVat`을 쓴다. 합계에서 다시 반올림하지 않는다.
- (팀 지식 `docs/knowledge/billing/credit-note-stored-amounts.md`) 저장된 `totals`는 다시 계산하지 않고, `returnedDiscount`의 수량 비율 할인 방식과 `src/format/`의 출력 형식은 금액 계산을 고치면서 바꾸지 않는다.

## 추가 의견
- `quote.js`를 직접 호출(`createQuote`, `quoteTotals`)해도 CLI로도 56,278원이다. 56,280원은 영업팀이 전한 값이고 출처는 확인되지 않았다.
- 견적서를 출력하는 텍스트 렌더러는 `src/format/`에 없다(`renderInvoice`는 청구서 전용). 견적은 `src/cli.js`가 JSON으로 합계만 찍는다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e11-k9/25-invoice-quote-teammate-k9-5/relay-home-2/projects/billing-mate1-def2ab/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 10:07 (사람 승인)
- [사람] 경리 합계는 56,278원으로 두고 목표 금액으로 삼는다 — 사람이 답함: 경리 합계는 56,278원
- [AI] 반품 전표 `creditTotals`의 수정을 이번 Work 범위에 넣는다 — `npm test`가 기준 커밋에서 7건 실패하고 원인이 credit-note.js이다. 완료조건 `npm test 통과`를 만족하려면 고쳐야 하고, 팀 지식도 이 코드를 공용 함수로 바꿀 대상으로 적어 둠
```

## 누적 기각 목록

- t-01 intake: src/format에서 견적 출력 경로 찾기: 견적을 그리는 렌더러가 없다. renderInvoice는 청구서 전용

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "경리 합계는 56,278원으로 두고 목표 금액으로 삼는다"
    why: "사람이 답함: 경리 합계는 56,278원"
    by: human
  - what: "반품 전표 `creditTotals`의 수정을 이번 Work 범위에 넣는다"
    why: "`npm test`가 기준 커밋에서 7건 실패하고 원인이 credit-note.js이다. 완료조건 `npm test 통과`를 만족하려면 고쳐야 하고, 팀 지식도 이 코드를 공용 함수로 바꿀 대상으로 적어 둠"
    by: ai
assumptions:
  - "56,280원은 코드 밖(영업팀이 본 옛 발행본, 다른 시스템 등)에서 나온 값일 것이라고 가정함. 확인 안 됨"
rejected:
  - "src/format에서 견적 출력 경로 찾기: 견적을 그리는 렌더러가 없다. renderInvoice는 청구서 전용"
open_questions: []
intent_deviation:
  summary: "요청은 견적 합계 계산이 틀렸다고 하지만, 현재 코드는 Q-0457을 56,278원으로 계산해 경리 합계와 같다"
  evidence: "createQuote, quoteTotals 직접 호출과 CLI 모두 supply 52691, vat 3587, total 56278. test/vat-rule.test.js:55도 56,278을 단언함"
risks:
  - "56,280원의 출처가 없어, 견적 쪽에서는 코드 변경 없이 테스트 보강만 남을 수 있다"
  - "credit-note.js 수정은 요청 밖이다. 사람이 범위에서 빼려면 npm test 실패 7건이 남는다"
recommended_next: null
knowledge_candidates:
  - "56,280원은 영업팀이 전한 Q-0457 합계이고 출처를 알 수 없다. 코드는 56,278원으로 경리와 같다 (사람)"
---
## 요약
영업팀에 확인할 수 없는 상황이라 56,280원은 출처 없이 둔다. 견적 계산은 이미 경리와 같은 56,278원이다. 그래서 의도를 "견적 합계를 테스트로 고정"과 "깨진 npm test 복구"로 잡았다. 견적 출력 텍스트는 src/format에 없고, 부가세 처리는 청구서와 견적이 `sumLineVat`을 같이 쓴다.
## 다음 task가 알아야 할 것
- 기준 커밋에서 `npm test` 58건 중 7건 실패(반품 전표 관련). 원인: `src/invoice/credit-note.js:94`가 `VAT_RATE_PERCENT`를 import하지 않아 ReferenceError. 같은 파일은 `sumLineVat`을 import하고 안 씀
- `creditTotals`(credit-note.js:88~96)를 `sumLineVat(rows, note.zeroRated)`로 바꾸는 것이 팀 지식의 방향 (내 추측: 이것만으로 7건이 풀릴 것, 확인 안 됨)
- 견적: `src/invoice/quote.js` `quoteTotals`는 `sumLineVat`을 씀. 결과 52,691 / 3,587 / 56,278. `test/vat-rule.test.js:55`가 이미 검증
- 견적 출력: `src/cli.js:49~50`이 JSON만 찍음. `src/format/invoice-text.js`는 청구서 전용
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md`, `docs/knowledge/billing/credit-note-stored-amounts.md`
```

## 필요한 산출물

없음
