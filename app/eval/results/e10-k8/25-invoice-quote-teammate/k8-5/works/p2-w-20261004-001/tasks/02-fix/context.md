# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/25-invoice-quote-teammate-k8-5/relay-home-2/projects/billing-mate1-cd9760/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 41982d61757f21d6fa6fb8c6552cbc7770810b32

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/billing/example-json-needs-normalize.md

```markdown
---
kind: pitfall
source: investigation
---
# examples/*.json은 createInvoice로 정규화해야 과세 구분이 채워진다

## 내용
- `examples/*.json`을 정규화 없이 `computeTotals`에 넣으면 `taxType`가 없어 전 줄이 면세로 계산된다. 재현이나 비교 스크립트에서는 먼저 `createInvoice`를 거친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/billing/vat-per-line-floor.md

```markdown
---
kind: rule
source: human
anchor: lineVat
---
# 부가세는 할인된 줄 금액에 줄마다 원 단위 버림으로 계산해 합산한다

## 규칙
- 회계팀 규정: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액(공급가액)에 품목 줄마다 원 단위 버림으로 구한 값의 합이다. 합계에서 다시 반올림하지 않는다. 예: `examples/INV-2031.json`은 부가세 2,641원, 합계 29,079원.
- 청구서, 반품 전표, 견적서 모두 적용된다. 계산은 `src/invoice/total.js`의 `lineVat`/`sumLineVat`을 공유한다.
- 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 0이다.
- 새로 계산하는 문서부터 적용한다. 발행된 청구서와 반품 전표는 저장된 totals를 재계산하지 않는다.

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
거래처 C-0388이 문의한 견적서 Q-0457의 합계(현재 56,280원)가 경리 계산과 몇 원 다른 문제를 바로잡는다.

## 비목표
- 견적 번호 형식(`Q-0000`)과 유효 기간 계산(`quoteValidUntil`, `isQuoteExpired`, `validDays`)은 바꾸지 않는다. 영업 시스템이 그대로 읽는다.
- 청구서와 반품 전표의 계산 방식은 바꾸지 않는다.
- 이미 발행된 문서의 저장된 totals는 재계산하지 않는다.

## 원하는 결과
`examples/Q-0457.json`으로 만든 견적서의 합계가 회계팀 규정(할인은 줄마다 부가세 전에 적용, 부가세는 할인된 줄 금액에 줄마다 원 단위 버림 후 합산)으로 계산한 값과 일치한다. 같은 원인이 다른 견적서에도 있으면 함께 바로잡힌다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (Q-0457 합계가 규정 계산값과 같다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 견적 번호 형식과 유효 기간 계산의 결과가 수정 전과 같다
- [ ] Q-0457 합계가 규정대로 줄별 계산한 값과 일치함을 보이는 테스트가 있다

## 제약
- (팀 지식 `docs/knowledge/billing/vat-per-line-floor.md`) 회계팀 규정: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 품목 줄마다 원 단위 버림으로 구한 값의 합이다. 합계에서 다시 반올림하지 않는다. 견적서도 적용 대상이며 `src/invoice/total.js`의 `lineVat`/`sumLineVat`을 공유한다. 면세 줄과 영세율 문서의 부가세는 0이다.

## 추가 의견
- 요청의 경리 계산 금액은 적혀 있지 않아, 기준은 위 규정으로 계산한 값이다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/25-invoice-quote-teammate-k8-5/relay-home-2/projects/billing-mate1-cd9760/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:38 (사람 승인)
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
  - "경리 계산 금액이 요청에 없어, 기준을 회계팀 규정(줄별 버림 부가세)으로 계산한 값으로 잡았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "경리가 규정 외 방식으로 계산했을 가능성은 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457 합계 오차를 바로잡는 버그 수정 의도 초안을 썼다. 견적 번호 형식과 유효 기간 계산은 비목표로 못 박았다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/quote.js`의 `quoteTotals`, 데이터: `examples/Q-0457.json`, 테스트: `test/quote.test.js`, 명령: `npm test`
- 훑어본 인상(가설, 확인 안 됨): `quoteTotals`는 이미 `sumLineVat`을 쓰는 것처럼 보인다. 원인은 `lineGross`/`lineDiscount`/`isTaxableLine` 쪽일 수 있다.
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md`(제약에 옮김), `docs/knowledge/billing/example-json-needs-normalize.md`(예제 JSON은 정규화해야 과세 구분이 채워짐)
```

## 필요한 산출물

없음
