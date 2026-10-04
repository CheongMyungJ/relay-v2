# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/21-invoice-credit-k8-5/relay-home/projects/billing-586c0d/works/w-20261004-002/tasks/02-fix
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: e926b2d603c697bdbb74a850ceced32540f38c1b

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

#### docs/knowledge/invoice/issued-invoice-totals-and-format.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 발행된 청구서는 재계산하지 않고, src/format/ 출력 형식은 바꾸지 않는다

## 규칙
- 발행된 청구서는 합계를 다시 계산하지 않고 저장된 `totals`를 쓴다 (`invoiceTotals`). 계산 규칙이 바뀌어도 발행분에는 소급하지 않는다.
- `src/format/` 출력 형식은 PDF 생성기가 쓰므로 바꾸지 않는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/invoice/vat-per-line-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
anchor: computeTotals
---
# 청구서 부가세는 줄마다 원 단위 버림 후 합산한다

## 규칙
- 부가세는 품목 줄마다 (할인 적용 후 과세 공급가액 × 세율)을 원 단위로 버림(`Math.floor`)해 구하고, 그 합을 청구서 부가세로 쓴다. 합계에서 다시 반올림하지 않는다 (회계팀 방식).
- 할인은 부가세 전에 줄마다 적용한다. 면세 줄은 합산에서 제외하고, 영세율 청구서는 0이다.
- 예: INV-2031은 줄별 536+633+325+837+310 = 2,641원, 합계 29,079원 (합계 기준 반올림이면 2,644원).

## 아직 규칙을 따르지 않는 곳
- src/invoice/credit-note.js: `creditTotals`는 아직 합계 기준 `Math.round`라 청구서와 계산 방식이 다르다 (이번 Work에서는 범위 밖으로 둠).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
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
반품 전표(CN-0112 등)의 환불 금액이 회계팀 계산과 맞도록 `src/invoice/credit-note.js`의 반품 금액 계산을 바로잡는다.

## 비목표
- 이미 저장된(발행된) 반품 전표와 청구서의 `totals`를 다시 계산하거나 소급 수정하지 않는다.
- `src/format/` 출력 형식은 바꾸지 않는다.
- 청구서 합계 계산(`computeTotals`)은 바꾸지 않는다.
- 금액 할인을 수량 비율로 나누는 계산(`returnedDiscount`)은 회계팀과 맞춘 방식이므로 바꾸지 않는다.

## 원하는 결과
- 반품 전표 부가세와 환불 합계가 청구서와 같은 회계팀 방식(줄마다 원 단위 버림 후 합산)으로 계산된다.
- examples/CN-0112.json을 examples/INV-2047.json에 적용해 만든 전표의 환불 합계가 회계팀 계산과 일치한다. 현재 19,182원이고, 회계팀이 기대하는 정확한 금액은 요청에 없다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (CN-0112의 환불 합계가 회계팀 계산 방식의 값과 같다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 반품 전표의 부가세가 줄마다 (할인 적용 후 과세 공급가액 × 세율)을 원 단위 버림한 값의 합이다
- [ ] 면세 줄은 부가세 합산에서 제외되고, 영세율 전표의 부가세는 0이다
- [ ] 위 계산을 확인하는 테스트(CN-0112 사례 포함)가 추가된다

## 제약
- (팀 지식 docs/knowledge/invoice/vat-per-line-floor.md) 부가세는 품목 줄마다 (할인 적용 후 과세 공급가액 × 세율)을 `Math.floor`로 버림해 합산하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용한다. 면세 줄은 제외, 영세율은 0.
- (팀 지식 docs/knowledge/invoice/issued-invoice-totals-and-format.md) 발행된 문서는 저장된 `totals`를 쓰고 소급하지 않는다. `src/format/` 출력 형식은 바꾸지 않는다.

## 추가 의견
- 요청은 파일로 `src/invoice/credit-note.js`만 짚었고, 원인에 대한 사람의 추정은 없다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/21-invoice-credit-k8-5/relay-home/projects/billing-586c0d/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:13 (사람 승인)
- [AI] 반품 전표 부가세는 청구서와 같은 줄별 원 단위 버림 합산 규칙을 따르는 것으로 목표를 잡았다 — 팀 지식 vat-per-line-floor.md가 creditTotals를 규칙을 아직 따르지 않는 곳으로 적고 있어 다시 묻지 않음
- [사람] 금액 할인의 수량 비율 나눔(returnedDiscount)은 그대로 두고 비목표로 한다 — 사람이 회계팀과 맞춘 방식이라고 알려 줌
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 청구서와 같은 줄별 원 단위 버림 합산 규칙을 따르는 것으로 목표를 잡았다"
    why: "팀 지식 vat-per-line-floor.md가 creditTotals를 규칙을 아직 따르지 않는 곳으로 적고 있어 다시 묻지 않음"
    by: ai
  - what: "금액 할인의 수량 비율 나눔(returnedDiscount)은 그대로 두고 비목표로 한다"
    why: "사람이 회계팀과 맞춘 방식이라고 알려 줌"
    by: human
assumptions:
  - "회계팀이 기대하는 정확한 환불 금액은 요청에 없어, 회계팀 방식(줄별 버림)으로 계산한 값을 기대값으로 본다"
  - "이미 발행된 반품 전표는 소급 수정하지 않는다 (팀 지식 규칙)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 규칙을 남겼고 머지 대기라 docs/knowledge/ 파일이 이 브랜치에는 없다"
recommended_next: null
knowledge_candidates:
  - "반품 전표에서 금액 할인을 돌려받는 수량 비율로 나누는 방식(returnedDiscount, 원 단위 반올림)은 회계팀과 맞춘 방식이라 바꾸지 않는다 (사람)"
---
## 요약
CN-0112 환불 합계(19,182원)가 회계팀 계산과 몇 원씩 다른 버그의 의도 초안을 썼다. 목표는 반품 전표 부가세를 청구서와 같은 줄별 버림 방식으로 맞추는 것이다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js`의 `creditTotals`. `returnedDiscount`는 건드리지 않는다. 테스트는 `test/credit-note.test.js`, 실행은 `npm test`(`node --test`).
- 재현 입력: examples/CN-0112.json, examples/INV-2047.json (INV-2047 totals: vat 5,801, total 63,807).
- 참고 지식: docs/knowledge/invoice/vat-per-line-floor.md, docs/knowledge/invoice/issued-invoice-totals-and-format.md (기준 브랜치에는 아직 없음).
- 가설(확인 안 됨): `creditTotals`가 과세 합계에 `Math.round`를 쓴다.
```

## 필요한 산출물

없음
