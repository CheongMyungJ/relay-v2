# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-k8/23-double-notify-digest-k8-4/relay-home/projects/notify-939c42/works/w-20261004-002/tasks/02-fix
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: 7d7867c4a847b0730e38002bc2c511b7e2b6a16b

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

#### docs/knowledge/retry/digest-key-includes-run-id.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
---
# 요약 키에 runId가 들어가 재실행 시 같은 요약이 다시 나갈 수 있다

## 내용
- `src/digest/key.js`의 요약 키에 runId가 포함되어, 서로 다른 실행(재실행)에서는 같은 요약이 중복 발송될 수 있다. 같은 실행 안의 중복과는 별개이며 Work w-20261004-001에서는 고치지 않았다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/retry/failed-sends-must-retry.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
---
# 중복 발송은 재시도를 끄지 않고 고친다. 실제로 실패한 발송은 반드시 재발송한다

## 규칙
- 중복 발송 문제를 재시도 기능을 끄거나 재시도 횟수를 줄여서 해결하지 않는다.
- 어댑터가 실제로 실패한 발송(일시 오류 등)은 재시도로 다시 보낸다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/retry/success-is-never-resent.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: investigation
anchor: decide
---
# 발송이 성공했으면 걸린 시간과 무관하게 재발송하지 않는다

## 규칙
- 어댑터가 성공(`outcome.ok`)을 돌려주면 제한 시간(`send.timeoutMs`, `digest.sendTimeoutMs`)을 넘겼어도 성공이다. 시간 초과 판정은 실패한 발송에만 쓴다.
- 발송 경로(`src/retry/policy.js` `decide`)와 요약 경로(`src/digest/deadline.js` `withDeadline`) 모두 같다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001). 이전에는 느린 성공을 timeout 실패로 보고 재시도해 메일이 2~3번 나갔다.
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
아침 요약 메일(전날 알림 모음)이 같은 날 고객에게 두 통, 세 통 나가는 문제의 원인을 찾아 고친다.

## 비목표
- 재시도 기능을 끄거나 재시도 횟수를 줄이는 방식의 해결은 하지 않는다.
- 요약 외의 기능 개선이나 리팩터링은 하지 않는다.

## 원하는 결과
- 같은 날 같은 요약은 고객에게 한 번만 나간다.
- 어댑터가 실제로 실패한 요약 발송은 여전히 재발송되어, 요약이 하루 건너뛰어지지 않는다.
- 요약이 나가는 모든 경로(예: 스케줄러 실행, 재시도, 재실행)마다 고객이 한 번만 받는다는 근거를 보여 준다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 같은 날 같은 요약이 두 번 이상 발송되던 경우를 재현하는 테스트가 추가되어 통과한다
- [ ] 어댑터가 일시 오류 등으로 실제 실패한 요약은 재발송되고 결국 한 번 전달됨을 보이는 테스트가 통과한다
- [ ] 요약이 발송되는 각 경로별로 고객이 한 번만 받는다는 근거(테스트 또는 코드 위치)가 결과에 정리되어 있다

## 제약
- (팀 지식 docs/knowledge/retry/failed-sends-must-retry.md) 중복 발송은 재시도를 끄거나 횟수를 줄여서 해결하지 않는다. 실제로 실패한 발송은 반드시 재발송한다.
- (팀 지식 docs/knowledge/retry/success-is-never-resent.md) 어댑터가 성공(`outcome.ok`)을 돌려주면 제한 시간을 넘겼어도 성공으로 보고 재발송하지 않는다. 발송 경로와 요약 경로 모두 같다.

## 추가 의견
- 없음
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-k8/23-double-notify-digest-k8-4/relay-home/projects/notify-939c42/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:02 (사람 승인)
- [AI] 요청 유형은 bugfix 그대로 두고 질문 없이 초안을 썼다 — 요청이 현재 동작이 틀렸다고 말하므로 유형과 맞다
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요청 유형은 bugfix 그대로 두고 질문 없이 초안을 썼다"
    why: "요청이 현재 동작이 틀렸다고 말하므로 유형과 맞다"
    by: ai
assumptions:
  - "요약 발송 경로는 여러 개(스케줄러, 재시도, 재실행 등)일 수 있어 경로별 근거를 완료조건에 넣었다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 느린 성공을 timeout 실패로 보고 재시도하는 문제(src/retry/policy.js, src/digest/deadline.js)"
  - "src/digest/key.js의 요약 키에 runId가 포함되어 재실행 간 중복 가능(팀 지식상 앞 Work에서 미해결). 이번 요청의 '같은 날 여러 통'과 관련될 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
아침 요약 메일 중복 발송 버그의 intent 초안을 썼다. 재시도를 끄지 않고, 실제 실패는 재발송하며, 경로별 한 번 발송 근거를 요구한다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 관련 코드: `src/digest/` (key.js, runner.js, scheduler.js, ledger.js, deadline.js), `src/retry/policy.js`
- 참고 팀 지식(조사 결과, 원인 확정 아님): `docs/knowledge/retry/digest-key-includes-run-id.md`, `docs/knowledge/retry/success-is-never-resent.md`
- 이 지식은 기준 브랜치에 아직 없고 앞 Work의 수정도 이 브랜치에 없다.
```

## 필요한 산출물

없음
