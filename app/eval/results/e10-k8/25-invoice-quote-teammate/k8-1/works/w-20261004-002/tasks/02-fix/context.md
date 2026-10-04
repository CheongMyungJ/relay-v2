# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/25-invoice-quote-teammate-k8-1/relay-home/projects/billing-7ef6e7/works/w-20261004-002/tasks/02-fix
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: 89e39a7f4d488abd47956dd5221c8ece68c49550

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/format/output-frozen.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# `src/format/`의 출력 형식은 바꾸지 않는다

## 규칙
- PDF 생성기가 `src/format/`의 출력을 그대로 찍으므로 출력 형식을 바꾸면 안 된다. 계산 값이 바뀌어도 서식 코드는 건드리지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/invoice/issued-totals-are-stored.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 발행된 청구서와 반품 전표는 저장된 합계를 그대로 쓰고 재계산하지 않는다

## 규칙
- 발행된 청구서는 `invoiceTotals`(src/invoice/invoice.js)가 저장된 `totals`를 그대로 쓴다. 계산 규칙을 바꿔도 이미 발행된 것은 다시 계산하지 않는다.
- 반품 전표도 `creditNoteTotals`로 저장된 금액을 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 부가세는 할인 후 줄 금액마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 과세 줄 금액마다 `Math.floor(net * 10 / 100)`로 계산해 그 합을 부가세로 쓴다 (회계팀 규칙).
- 합계에서 다시 반올림하지 않는다. 예: INV-2031 부가세 2,641원, 합계 29,079원 (합계 반올림이면 2,644원).
- 청구서(`src/invoice/total.js` computeTotals), 견적(`quote.js` quoteTotals), 반품 전표(`credit-note.js` creditTotals)가 같은 규칙을 쓴다. 영세율은 부가세 0, 면세 줄은 부가세 제외.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌). 견적·반품 전표는 같은 Work의 리뷰에서 사람이 골라 함께 바꿨다
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
반품 전표(`src/invoice/credit-note.js`)의 환불 금액이 회계팀 계산과 몇 원씩 어긋나는 문제를 바로잡는다. 예: CN-0112(INV-2047의 반품)의 환불 합계 19,182원.

## 비목표
- `src/format/`의 출력 형식 변경
- 이미 발행된 청구서와 이미 만든 반품 전표의 재계산 (저장된 `totals`를 그대로 쓴다)
- 청구서(`total.js`)와 견적(`quote.js`)의 계산 변경

## 원하는 결과
새로 만드는 반품 전표의 환불 금액이 회계팀 규칙(할인은 부가세 전에 줄마다 적용, 부가세는 할인 후 과세 줄마다 원 단위 버림 후 합산)과 일치한다. CN-0112는 이 규칙으로 계산한 금액이 나온다.

## 완료조건
- [ ] 재현 절차(examples/CN-0112.json, examples/INV-2047.json으로 반품 전표 생성)가 더 이상 틀린 금액을 내지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] CN-0112의 환불 금액이 줄별 버림 규칙으로 직접 계산한 값과 같다
- [ ] 영세율 반품은 부가세 0, 면세 줄은 부가세에서 제외되는 기존 동작이 유지된다
- [ ] 이미 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 그대로 돌려준다
- [ ] `src/format/` 파일에 변경이 없다

## 제약
- (팀 지식 docs/knowledge/invoice/vat-per-line-floor.md) 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 과세 줄 금액마다 `Math.floor(net * 10 / 100)`로 계산해 합산한다. 합계에서 다시 반올림하지 않는다.
- (팀 지식 docs/knowledge/invoice/issued-totals-are-stored.md) 반품 전표는 `creditNoteTotals`로 저장된 금액을 쓴다. 재계산하지 않는다.
- (팀 지식 docs/knowledge/format/output-frozen.md) `src/format/`의 출력 형식은 바꾸지 않는다.

## 추가 의견
- 없음
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/25-invoice-quote-teammate-k8-1/relay-home/projects/billing-7ef6e7/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 04:58 (사람 승인)
- [AI] 기대 금액은 팀 지식의 줄별 버림 부가세 규칙을 기준으로 한다 — 팀 지식 vat-per-line-floor.md가 반품 전표(creditTotals)에도 같은 규칙을 적용한다고 명시
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 금액은 팀 지식의 줄별 버림 부가세 규칙을 기준으로 한다"
    why: "팀 지식 vat-per-line-floor.md가 반품 전표(creditTotals)에도 같은 규칙을 적용한다고 명시"
    by: ai
assumptions:
  - "회계팀의 정확한 기대 금액은 요청에 없어, 팀 지식의 규칙으로 계산한 값을 기대값으로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 견적과 반품 전표 계산을 고쳤을 수 있음, 머지 대기. 이 브랜치의 creditTotals는 아직 Math.round를 쓴다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액 불일치를 고치는 bugfix 의도 초안을 썼다. 원인과 수정 방법은 적지 않았다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js`의 `creditTotals`, `returnedDiscount`. 재현 입력은 `examples/CN-0112.json`, `examples/INV-2047.json`
- 테스트: `npm test` (node --test), 관련 `test/credit-note.test.js`
- 참고할 팀 지식(기준 브랜치에는 아직 없음): `docs/knowledge/invoice/vat-per-line-floor.md`, `docs/knowledge/invoice/issued-totals-are-stored.md`, `docs/knowledge/format/output-frozen.md`
```

## 필요한 산출물

없음
