# `work-start` — 의도 정돈

## 목적

사용자의 요청을 **검증 가능한 완료조건을 가진 intent 초안**으로 만든다. 이 Work가 선택된 파이프라인(v1: 버그 수정)에 맞는지도 판단한다.

## 입력 (context.md)

| 조각 | 내용 |
|---|---|
| initial-request | Work 생성 시 사용자가 적은 원문 (inline) |
| project-profile | 프로젝트 이름, 기본 브랜치, 등록된 check 이름, `test_file` 유무, `delivery.default`, 원격 유무, `gh` 사용 가능 여부 (inline) |
| gate-policy / next-options | 공통 |
| (worktree) | 코드 탐색 가능. 단, 이 스킬에서 원인 분석을 깊게 하지 않는다 |

## 결정 지점 (질문 예산: 최대 6개, 한 번에 묶음)

| # | 결정 | 사람이 정할 결정 (`requires_human`) | S에서 |
|---|---|---|---|
| 1 | 목표와 원하는 결과를 이렇게 이해한 것이 맞는가 | ✅ | 묻는다 |
| 2 | 완료조건 목록 (초안 제시 후 수정/추가) | ✅ | 묻는다 |
| 3 | 비목표 (건드리지 않을 것) | ✅ | 생략(초안에 "없음" 또는 추론값, 확인만) |
| 4 | 규모 S/M/L (추천과 이유 제시) | ✅ | 묻는다 |
| 5 | 전달: 로컬 브랜치만 / push / PR | ✅ | 묻는다 |
| 6 | 제약 (쓰면 안 되는 라이브러리, 호환성 등) | — | 생략 |

- 5번은 `project.delivery.default`가 `ask`일 때만 묻는다. 아니면 그 값을 쓰고 묻지 않는다. 원격이 없으면 `none` 고정. `gh`가 없으면 `pr` 선택지 대신 "push 후 브라우저 비교 URL"을 안내한다.
- 6번은 요청이나 코드에서 제약의 단서가 보일 때만 묻는다.

### 규모 추천 기준 (기본값)

| 규모 | 기준 | 경로 |
|---|---|---|
| S | 원인이 요청에 거의 드러나 있고, 1~2개 파일 안에서 끝날 것으로 보임 | evidence, rca 생략 |
| M | 재현은 가능하나 원인이 불명확 | 전체 경로 |
| L | 여러 모듈에 걸치거나 재현 조건이 불명확 | 전체 경로 + "Work를 나눌 수 있으면 나누세요" 안내 |

추천이 애매하면 **M**을 추천한다. S로 시작했다가 막히면 fix에서 rca/evidence로 돌아가는 전이가 있지만(오분류 탈출구), 그 반대보다 비용이 크다.

## 절차

1. 요청 원문과 project-profile을 읽는다. 필요하면 관련 코드를 **가볍게** 훑어 목표를 구체화한다(10분 이내 기준, 원인 추적 금지).
2. 파이프라인 적합성을 판단한다: 버그(기대 동작과 실제 동작의 차이)인가? 기능 요청, 리팩터링, 조사라면 `pipeline_fit: misfit`으로 두고 사람에게 알린다. 그래도 사람이 버그 수정으로 진행하겠다고 하면 그대로 진행한다.
3. intent 초안을 먼저 쓴다(`intent.draft.md`). 완료조건은 아래 규칙으로 채운다.
4. 초안 요약과 결정 지점 질문을 **한 메시지**로 보낸다. 각 질문에 추천안을 붙인다.
5. 답을 반영한다. 완료조건이 검증 불가능하면 **그 항목만** 다시 묻는다(최대 1회. 그래도 모호하면 `open_questions`에 남긴다).
6. `_close`.

### 완료조건 작성 규칙

- 한 항목 = 참/거짓을 가릴 수 있는 한 문장. "잘 동작한다", "개선된다"는 금지.
- 가능하면 앱이 확인할 수 있는 형태로 쓴다: 재현 테스트 통과, 등록된 check 통과, 기존 테스트 파일 무수정, 브랜치/PR 생성.
- 버그 수정 기본 항목(초안에 미리 넣고 사람이 지운다):
  - `재현 절차(또는 고정된 재현 테스트)가 더 이상 실패하지 않는다`
  - `` `cmd:test`가 통과한다 `` (등록된 이름으로)
  - `기존 테스트 파일을 약화하거나 삭제하지 않는다`
  - delivery가 pr이면 `` `relay/<work-id>` 브랜치로 (draft) PR이 생성된다 ``

## 완료조건 (이 스킬의)

- `intent.draft.md`가 `intent.v1` 머리글 스키마와 본문 절 규칙을 만족한다(검증 명령 `relay-validate intent`).
- 완료조건이 1개 이상이고 모두 위 규칙을 따른다.
- 결정 지점 1~5의 답이 `decisions`에 있다(`by: human` 또는 위임 시 `by: ai`).

## 산출물 템플릿 — `intent.draft.md`

`contracts/examples/intent.md`와 같은 형식. `version`은 context.md의 현재 intent 버전 + 1(처음이면 1). `type`은 파이프라인의 유형(v1: `bugfix`).

## handoff 확장

```yaml
artifacts: [intent.draft.md]
pipeline_fit: { verdict: fit, note: "로그인 후 즉시 401 — 기대 동작과 다름" }
```

## 하지 말 것

- 원인을 단정하거나 수정 방법을 intent에 쓰지 않는다(목표가 아니라 해법이 된다). 떠오른 가설은 handoff 본문 "다음 task가 알아야 할 것"에 참고로만 적는다.
- `intent.md`에 직접 쓰지 않는다. 확정은 g-intent 승인 시 앱이 한다.

## relay.json

```json
{ "schema_version": 1, "name": "work-start", "title": "의도 정돈",
  "summary": "요청을 검증 가능한 완료조건을 가진 intent로 정리",
  "produces": [ { "path": "intent.draft.md", "required": true,
                  "required_headings": ["목표", "비목표", "원하는 결과", "완료조건"] } ],
  "handoff_extensions": ["pipeline_fit"], "writes_code": false }
```
