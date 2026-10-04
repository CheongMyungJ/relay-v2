# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/25-invoice-quote-teammate-k7-5/relay-home/projects/billing-80fc9a/works/w-20261003-002/tasks/02-fix
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 973a500e7bab6e7cf4b4cd04cac6fef63ad9d8ad

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
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/invoice-vat-per-line-floor.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 부가세는 회사 전체 규칙으로 과세 줄마다 할인 후 금액에 원 단위 버림으로 계산해 합산한다

- 종류: 규칙
- 적용: 청구서·견적·반품 전표 (src/invoice/total.js의 lineVat을 함께 쓴다)
- 출처: 사람이 알려 줌 (회계팀 규칙, 회사 전체 부가세 규칙), relay Work w-20261003-001, 2026-10-03

품목 줄마다 할인을 먼저 적용하고, 과세 줄의 할인 후 금액에 세율을 곱해 원 단위 버림(floor)한다. 부가세는 그 줄별 부가세의 합이며 합계에서 다시 반올림하지 않는다.
면세 줄은 제외하고 영세율은 0원이다. 청구서·견적·반품 전표 모두 같다. 부가세를 계산하는 새 문서나 코드도 이 규칙을 따른다.
예: INV-2031 줄별 536+633+325+837+310 = 2,641원, 합계 29,079원. 과세 합계에 한 번 반올림하면 2,644원(3원 차이)이다.
예: Q-0457 995+841+886+865 = 3,587원, 합계 56,278원. CN-0112 923+612+207 = 1,742원, 합계 19,180원.
```

#### docs/knowledge/issued-invoice-and-format-untouched.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 발행된 청구서는 재계산하지 않고, src/format/ 출력 형식은 바꾸지 않는다

- 종류: 규칙
- 적용: src/invoice/invoice.js (invoiceTotals), src/format/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

이미 발행된 청구서는 계산 규칙이 바뀌어도 다시 계산하지 않고 저장된 합계를 쓴다. 계산 규칙을 바꿔도 발행분 금액은 그대로여야 한다.
src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다.
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
반품 전표의 환불 금액(부가세 포함 합계)이 회계팀 계산과 맞도록 한다. 지금 CN-0112의 환불 합계는 19,182원으로 회계팀 계산과 몇 원 어긋난다.

## 비목표
- 이미 발행된 청구서와 이미 만든 반품 전표의 저장된 금액은 다시 계산하지 않는다.
- `src/format/` 출력 형식은 바꾸지 않는다.
- 청구서·견적의 부가세 계산 변경은 이번 요청 범위가 아니다(앞 Work w-20261003-001 담당).

## 원하는 결과
- 반품 전표를 새로 만들 때 부가세가 회사 규칙(과세 줄마다 할인 후 금액에 세율을 곱해 원 단위 버림, 줄별 부가세의 합)으로 계산된다.
- `examples/CN-0112.json`을 `examples/INV-2047.json`에 적용하면 줄별 부가세 합 1,742원, 환불 합계 19,180원이 된다.

## 완료조건
- [ ] 재현 절차(`examples/CN-0112.json`을 `examples/INV-2047.json`의 반품으로 만들기)가 더 이상 실패하지 않는다. 환불 합계가 19,180원이다.
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 면세 줄은 부가세에서 제외되고 영세율(`zeroRated`) 전표의 부가세는 0원이다.
- [ ] 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 다시 계산하지 않고 저장된 금액을 돌려준다.
- [ ] `src/format/` 아래 파일은 변경되지 않는다.

## 제약
- (팀 지식 `docs/knowledge/invoice-vat-per-line-floor.md`) 부가세는 회사 전체 규칙으로, 과세 줄마다 할인 후 금액에 세율을 곱해 원 단위 버림하고 줄별 부가세를 합산한다. 합계에서 다시 반올림하지 않는다. 면세 줄은 제외, 영세율은 0원. 반품 전표도 같다.
- (팀 지식 `docs/knowledge/issued-invoice-and-format-untouched.md`) 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다. `src/format/` 출력 형식은 바꾸지 않는다.

## 추가 의견
- 수정 대상으로 요청에 적힌 파일은 `src/invoice/credit-note.js`이다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/25-invoice-quote-teammate-k7-5/relay-home/projects/billing-80fc9a/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 13:42 (사람 승인)
없음
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "기대 금액 19,180원은 팀 지식(회계팀 규칙)의 CN-0112 예시를 따랐다. 코드로 재현해 확인하지는 않음"
  - "저장된 금액을 쓰는 기존 반품 전표는 재계산하지 않는다(요청 원문)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 청구서·견적의 부가세를 고쳤을 수 있음, 머지 대기. 이 브랜치에는 lineVat(src/invoice/total.js)이 아직 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 회사 부가세 규칙(줄별 버림 합산)을 반품 전표에도 적용하고, 발행분 재계산 금지와 src/format/ 불변을 제약에 넣었다.
## 다음 task가 알아야 할 것
- 참고(원인 아님): `src/invoice/credit-note.js`의 `creditTotals`는 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`로 과세 합계에 한 번 반올림한다. `src/invoice/total.js`의 `computeTotals`도 같은 모양이다. 줄별 계산과 다를 수 있다는 가설일 뿐, 확인하지 않았다.
- `returnedDiscount`의 금액 할인은 `Math.round`로 나눈다. 할인 반올림도 금액 차이의 후보일 수 있다(가설).
- 팀 지식 참고: `docs/knowledge/invoice-vat-per-line-floor.md`, `docs/knowledge/issued-invoice-and-format-untouched.md` (기준 브랜치에는 아직 없음)
- 테스트: `npm test` (`test/credit-note.test.js`, `test/total.test.js`)
```

## 필요한 산출물

없음
