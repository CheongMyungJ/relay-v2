# `intent-revise` — 의도 개정

## 목적

진행 중 드러난 사실 때문에 의도가 바뀌어야 할 때, **무엇이 바뀌고 그 때문에 무엇이 무효가 되는지**를 정리해 새 버전 intent 초안을 만든다. 승인은 항상 수동이다.

`work-start`와 intent 템플릿을 공유하지만 별도 스킬이다. 처음부터 묻는 대화와 차이·영향을 다루는 대화는 흐름이 다르다.

## 언제 열리나 (앱이 임시 노드 `x-intent-revise`로 끼워 넣음)

- 어떤 task의 handoff에 `intent_deviation`이 있고, 사용자가 승인 화면에서 [의도 수정]을 누름
- 사용자가 언제든 [의도 수정]을 누름 (진행 중 task는 `abandoned`)

## 입력 (context.md)

| 조각 | 내용 |
|---|---|
| intent | 현재 버전 전문 (inline) |
| revise-trigger | 세 부분으로 된 inline 조각: ① 계기(deviation 요약과 근거, 계기가 된 task와 산출물 경로 / 또는 사용자 입력 문구) ② 승인된 산출물 목록(`<node-id>/<file>`, 승인 시각, intent 버전) ③ 파이프라인 노드 목록과 설명(재개 노드 추천용) |
| decisions, rejected-log | 전체 (inline) |

## 결정 지점 (질문 예산: 최대 3개, 한 번에 묶음)

| # | 결정 | `requires_human` |
|---|---|---|
| 1 | 무엇을 바꿀 것인가 (목표 축소, 비목표 추가, 완료조건 수정, 규모, delivery) — 초안 차이로 제시 | ✅ |
| 2 | 무효로 볼 산출물 목록 (추천 제시) | ✅ |
| 3 | 어디서 재개할 것인가 (추천 노드와 이유) | ✅ |

## 절차

1. 계기를 읽고, 현재 intent의 어느 절과 충돌하는지 짚는다.
2. 새 intent 초안(`intent.draft.md`, version = 현재+1)과 차이 설명(`intent.diff.md`)을 쓴다.
3. 영향 분석: 승인된 산출물마다 새 intent에서도 유효한지 판단한다. 판단 기준:
   - 완료조건이 바뀌면 → verification은 무효
   - 목표/비목표가 바뀌어 원인 범위가 달라지면 → rca 무효 가능
   - 재현 대상 동작이 바뀌면 → evidence 무효, 재현 테스트 고정 해제 필요를 `risks`에 적음
4. 재개 노드를 추천한다. 무효가 된 산출물 중 **가장 앞 노드**가 기본 추천이다.
5. 결정 지점을 한 번에 묻고 반영한다.
6. `_close`.

## 완료조건

- `intent.draft.md`가 intent 스키마를 만족하고 version이 현재+1이다.
- `intent.diff.md`에 바뀐 절마다 전/후/이유가 있다.
- 영향 분석 표가 승인된 산출물 **전부**를 다룬다.
- `intent_revision` 확장 필드가 채워져 있다.

## 산출물 템플릿 — `intent.diff.md`

```markdown
# 의도 개정 v<N> → v<N+1>

## 계기
- (deviation 요약 / 사용자 요청), 근거: tasks/05-fix/handoff.md

## 바뀐 절
| 절 | 전 | 후 | 이유 |
|---|---|---|---|

## 영향 분석
| 산출물 | 유효 | 이유 |
|---|---|---|
| evidence/evidence.md | 유효 | 재현 대상 동작 변화 없음 |
| rca/rca.md | 무효 | 비목표에서 refresh 경로가 빠져 원인 범위가 넓어짐 |

## 재개 노드
- rca (추천) — 이유
```

## handoff 확장

```yaml
artifacts: [intent.draft.md, intent.diff.md]
intent_revision:
  draft: intent.draft.md
  diff: intent.diff.md
  stale_artifacts: [rca/rca.md]
  resume_node: rca
```

## 승인 후 앱이 하는 일 (참고)

intent 버전 증가와 이전 버전 보관, `stale_artifacts` 표시, `resume_node`에서 재개(state-machine.md 5.7). 이후 task에는 최신 intent만 inline으로 주입되고, stale 산출물은 표시가 붙은 채 path로 전달된다.

## 하지 말 것

- 코드나 다른 산출물을 고치지 않는다.
- 사람이 요청하지 않은 목표 확장을 넣지 않는다.

## relay.json

```json
{ "schema_version": 1, "name": "intent-revise", "title": "의도 개정",
  "summary": "의도 변경과 영향 받는 산출물 정리",
  "produces": [
    { "path": "intent.draft.md", "required": true, "required_headings": ["목표", "비목표", "원하는 결과", "완료조건"] },
    { "path": "intent.diff.md", "required": true, "required_headings": ["계기", "바뀐 절", "영향 분석", "재개 노드"] } ],
  "handoff_extensions": ["intent_revision"], "writes_code": false }
```
