# `_close` — 공통 종료 절차

모든 스킬 SKILL.md의 마지막 절로 삽입한다. 세션 재개 마무리용 `relay-close` 스킬도 이 텍스트를 그대로 쓴다.

## 목적

산출물을 확정하고, 스키마에 맞는 handoff를 쓰고, 사람에게 다음 행동을 알린다. **승인 자체는 하지 않는다.** 승인은 앱이 한다(D3).

## 언제 실행하나

- 스킬의 완료조건을 모두 만족했을 때
- 더 진행할 수 없을 때 (`status: blocked`)
- 사람이 "여기서 마무리해" 또는 "handoff 써 줘"라고 할 때

사람이 수정을 요청하면 산출물과 handoff를 고친 뒤 이 절차를 다시 실행한다. handoff는 매번 **파일 전체를 다시 쓴다**(부분 수정 금지 — 앱이 쓰는 도중의 파일을 읽지 않도록, 임시 파일에 쓰고 이름을 바꾸는 방식 권장).

## 절차

1. **산출물 확정**
   - 스킬 명세의 필수 산출물이 `RELAY_TASK_DIR`에 있고 필수 제목(`##`)을 모두 갖췄는지 확인한다.
   - 코드를 바꾼 스킬이면 커밋이 끝났는지 `git status`로 확인한다. 커밋 안 된 변경이 있으면 커밋하거나, 의도적으로 남기는 이유를 `risks`에 적는다.
2. **handoff 작성** — `RELAY_TASK_DIR/handoff.md`, 템플릿은 아래.
   - `status`: 보통 `awaiting_approval`. 진행 불가면 `blocked`와 `blocked_reason`.
   - `decisions`: 이 task에서 정한 것. 사람이 답한 것은 `by: human`. 스킬 명세에서 "사람이 정할 결정"으로 표시한 항목은 `requires_human: true`.
   - `rejected`: 기각한 가설, 방법, 대안. 없으면 `[]`이지만 필드는 반드시 쓴다.
   - `open_questions`: 사람 답이 필요한데 아직 없는 것. 추측으로 채우지 않는다.
   - `intent_deviation`: 의도의 목표, 비목표, 완료조건과 어긋나는 사실을 발견했으면 요약과 근거.
   - `recommended_next`: context.md의 next-options 중 기본 아닌 곳으로 가야 할 때만. 기본이면 `null`.
   - `knowledge_candidates`: 이 프로젝트에서 다음에도 쓸 만한 사실(선택).
3. **검증** — context.md에 적힌 검증 명령을 실행한다. 오류가 있으면 고치고 다시 실행한다. 앱도 Stop 시점에 같은 검증을 하고, 형식 오류면 최대 2회까지 오류 목록을 되돌려 준다(D21). 되돌아온 오류는 **형식만** 고친다. 내용을 바꾸라는 뜻이 아니다.
4. **안내 문구 출력** — context.md의 gate-policy 절에 따라 한 가지를 출력하고 턴을 끝낸다.
   - manual: "산출물을 검토하고 [Task 완료]를 눌러 주세요. 고칠 점이 있으면 여기에 말씀해 주세요."
   - auto_if_checks: "검사가 통과하면 15초 뒤 자동으로 다음 단계로 진행합니다. 멈추려면 [취소]를 누르세요."
   - blocked: "진행할 수 없습니다: <blocked_reason>. 오른쪽 패널에서 다음 단계를 골라 주세요."

## handoff 템플릿

```markdown
---
schema_version: 1
work_id: <context.md의 work>
task_id: <context.md의 step>
node: <context.md의 node>
skill: <스킬 이름>
status: awaiting_approval
intent_version: <context.md의 intent 버전>
artifacts: [<산출물 파일명>]
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks: []
self_checks: []
recommended_next: null
knowledge_candidates: []
# 스킬별 확장 필드 (스킬 명세 참고)
---
## 요약
<3~5문장. 이 task에서 무엇을 알아냈거나 바꿨는가>

## 다음 task가 알아야 할 것
- <경로:줄, 명령, 수치 등 재발견 비용이 큰 사실>

## 사람이 검토할 때 볼 곳
- <산출물의 어느 절, 어떤 커밋>
```

본문 전체 분량 기준: 약 1,500자(기본값). prev-handoff 제공자가 inline으로 주입하기 때문이다.

## 하지 말 것

- handoff에 git 커밋 해시, 검사 통과 여부를 "사실"로 적지 않는다(앱이 직접 확인한다. 참고용이면 `self_checks`).
- `status: approved`를 쓰지 않는다(스키마가 거부).
- 승인을 요청한 뒤 사람 말 없이 산출물을 계속 고치지 않는다(자동 승인 카운트다운이 취소된다).
