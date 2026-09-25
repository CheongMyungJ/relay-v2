# 파이프라인 상태 기계

- 계약 버전: v1 (`pipeline.v1`, `work.v1`, `event.v1`)
- 이 문서는 앱 메인 프로세스의 `PipelineEngine`이 따르는 규칙이다. 엔진은 **순수 함수**로 구현한다: `(work, pipeline, intent, 입력 신호) → (새 work, 발행할 이벤트, 부수 효과 요청)`. 프로세스 실행, 파일 쓰기, git 호출은 엔진 밖에서 한다(architecture.md 2절).

---

## 1. 파이프라인 로드 검증

스키마 검증(`pipeline.v1.schema.json`)에 더해 로드 시 다음을 검사한다. 하나라도 실패하면 그 파이프라인으로는 Work를 만들 수 없다.

| # | 규칙 |
|---|---|
| P1 | 노드 id가 유일하다. `x-`로 시작하는 id는 금지(임시 노드용 예약) |
| P2 | 첫 노드는 skill 노드, 그다음은 `on_pass`에 `intent.approve`가 있는 human 게이트다 (intent 없이 진행하지 않음) |
| P3 | 마지막 노드는 `on_pass`에 `work.complete`가 있는 human 게이트다. `work.complete`는 이 노드에만 있다 |
| P4 | `intent.approve`, `work.complete`가 있는 게이트에는 `when`을 쓸 수 없다 (의도 승인과 Work 완료는 항상 수동, D7) |
| P5 | `on_fail`, `transitions`의 키와 값이 모두 존재하는 노드 id다. `on_fail`은 자기보다 앞선 skill 노드다. `transitions`와 `on_fail`의 대상에 첫 노드(intake)와 human 게이트는 올 수 없다(의도 변경은 intent-revise로, 완료는 기본 경로로) |
| P6 | 모든 `skill`이 `<RELAY_HOME>/skills/<name>/relay.json`을 가진다 |
| P7 | `requires`의 `<node-id>/<file>`에서 node-id가 존재하고, 그 노드 스킬의 `produces`에 file이 있다 |
| P8 | `auto_checks`/`run`의 `cmd:<key>`는 Work 생성 시점에 `project.json checks`에 있어야 한다(Work 생성 시 검사) |
| P9 | `when` 식이 문법에 맞고 intent 머리글의 필드만 참조한다 |

---

## 2. Work 상태

| 상태 | 뜻 | 사이드바 배지 |
|---|---|---|
| `active` | 진행 중. 현재 step이 실행 중이거나 곧 열림 | 파랑 ● |
| `needs_attention` | 앱이 자동으로 진행할 수 없어 사람이 골라야 함 (`attention.reason`) | 주황 ! |
| `paused` | 사용자가 멈춤, 또는 세션 상한 때문에 대기 | 회색 ‖ |
| `completed` | `g-done` 통과 | 초록 ✓ |
| `abandoned` | 사용자가 포기 | 회색 ✕ |
| `archived` | [Work 정리]로 worktree 제거 완료 | 표시 안 함(보관함) |

전이:

| 현재 | 입력 | 다음 | 부수 효과 |
|---|---|---|---|
| (없음) | Work 생성 + worktree/setup 성공 | `active` | `work.created`, 첫 노드 step 열기 |
| (없음) | setup 실패 | (생성 취소) | worktree 제거, 로그 표시. 사용자는 수정 후 재시도 |
| `active` | 앱이 다음을 정할 수 없음 (3.4절 표) | `needs_attention` | `work.needs_attention`, OS 알림 |
| `needs_attention` | 사용자가 선택지 중 하나 실행 | `active` | 선택에 따라 step 열기/재개 |
| `active`/`needs_attention` | [일시 정지] | `paused` | 실행 중 세션이 있으면 종료(재개 가능, `interrupted`) |
| `paused` | [재개] | `active` | 중단된 step을 `--resume`으로 재개하거나 다음 step 열기 |
| `active`/`needs_attention`/`paused` | [Work 포기] (확인 대화상자) | `abandoned` | 실행 중 step `abandoned`, 세션 종료, `work.abandoned` |
| `active` | `g-done` 통과 | `completed` | `work.deliver` → `work.complete` (5.6절) |
| `completed`/`abandoned` | [Work 정리] | `archived` | design.md 7.4절 |
| `abandoned` | [포기 취소] | `paused` | worktree가 남아 있을 때만 |

`completed`와 `archived`는 되돌리지 않는다. 같은 문제를 다시 다루려면 새 Work를 만든다(이전 Work의 산출물을 참조 입력으로 줄 수 있음, 향후).

---

## 3. Step 상태

step = 노드 한 번 실행. skill 노드 step은 task(=CLI 세션 1개)이고, gate 노드 step은 앱이 처리한다.

### 3.1 skill step

```
launching ──PTY 시작──▶ running ──유효한 handoff + Stop──▶ awaiting_approval ──승인──▶ approved
    │                     │  ▲                               │   ▲
    │                     │  └──── handoff 수정/재작성 ─────────┘   │
    │                     │                                        │
    │                     ├─ PTY 종료, handoff 없음 ─▶ ended_no_handoff ─[세션 재개]─▶ running
    │                     ├─ 앱 종료/충돌 ─────────▶ interrupted ─────[재개]──────▶ running
    │                     └─ 경로 변경/포기/의도 개정 ─▶ abandoned
    └─ 시작 실패(claude 없음 등) ─▶ interrupted (attention: session_crashed)
```

| 현재 | 입력 | 다음 | 비고 |
|---|---|---|---|
| `launching` | node-pty spawn 성공 | `running` | `task.started` |
| `running` | handoff 파일 생성/변경 감지 | `running` | 즉시 검증만 하고 결과를 패널에 표시. 상태는 Stop을 기다림 |
| `running` | Stop 신호 + 최신 handoff 유효 | `awaiting_approval` | `task.awaiting_approval`. 자동 승인 평가 시작(6절) |
| `running` | Stop 신호 + handoff 형식 오류 + 이번 턴에 handoff가 바뀜 + 되돌림 횟수 < 상한 | `running` | Stop 훅에 `block` 응답(D21). `task.handoff_invalid{feedback_sent:true}` |
| `running` | Stop 신호 + handoff 형식 오류 + 상한 도달 | `awaiting_approval`(invalid) | 승인 버튼 비활성, 오류 표시, [형식 오류 무시하고 승인] 제공 |
| `running` | Stop 신호 + handoff 없음 | `running` | 정상. 사람과 대화 중인 턴 끝 |
| `running`/`awaiting_approval` | PTY 종료 + 유효 handoff 있음 | `awaiting_approval` | 세션 없이 승인 가능 |
| `running` | PTY 종료 + handoff 없음 | `ended_no_handoff` | Work `needs_attention(handoff_missing)` |
| `awaiting_approval` | handoff가 다시 바뀜 (사용자가 수정 요청) | `running` | 카운트다운 취소 `condition_changed`. 다음 Stop에서 재평가 |
| `awaiting_approval` | 터미널 키 입력 | (유지) | 카운트다운만 `pause_on_input_sec` 동안 멈춤 |
| `awaiting_approval` | [Task 완료] 또는 자동 승인 | `approved` | 7절 승인 처리 |
| `running`/`awaiting_approval`/`ended_no_handoff`/`interrupted` | 경로 변경, Work 포기, 의도 개정 시작 | `abandoned` | 세션 종료, 산출물 보존 |
| `ended_no_handoff` | [세션 재개해 마무리] | `running` | `claude --resume <id> "<close 프롬프트>"` (design.md 8.3) |
| `interrupted` | [재개] | `running` | `claude --resume <id>` |

**Stop 신호 대신 쓰는 판단 (훅 유실 대비):** Stop 신호 없이 `awaiting_approval`로 가는 경우는 (a) PTY 종료 (b) 사용자가 [지금 검토]를 눌러 수동 승인 화면을 여는 경우뿐이다. 자동 승인은 **반드시 Stop 신호가 handoff의 마지막 수정 이후에 도착해야** 시작한다. 훅이 유실되면 자동 승인이 안 될 뿐, 진행은 막히지 않는다.

### 3.2 gate step

| 게이트 | 상태 흐름 |
|---|---|
| `check` | `running` → 모든 `run` 검사 pass/n/a면 `passed`, 아니면 `failed` |
| `human` | `waiting_human` → [승인] 시 `passed`. 사람이 반려하는 경우는 [다음 단계 변경]으로 처리(step은 `abandoned`) |
| `review` | v1 미구현. 로드 시 경고, 실행 시 `human`처럼 동작 |
| (공통) | `when`이 거짓이면 실행하지 않고 `skipped`로 기록 |

### 3.3 step 번호와 디렉터리

- `seq`는 Work 안에서 1부터 증가하고 skill/gate 공통이다. `step_id = t-<seq 2자리>`, 디렉터리 = `tasks/<seq 2자리>-<node_id>/`.
- `skipped` step은 디렉터리를 만들지 않고 work.json에만 기록한다.
- 같은 노드를 다시 실행하면 새 step이다(예: `05-fix`, `07-fix`). `requires`의 `fix/...`는 그 노드의 **가장 최근 approved step**을 가리킨다.

### 3.4 앱이 스스로 정할 수 없는 경우 (`needs_attention`)

| reason | 발생 조건 | 사용자에게 주는 선택지 |
|---|---|---|
| `gate_failure_limit` | 같은 check 게이트 연속 실패가 상한 도달 | [한 번 더 on_fail로] [다른 노드 선택] [재현 테스트 고정 해제] [Work 포기] |
| `handoff_missing` | CLI가 handoff 없이 종료 | [세션 재개해 마무리] [새 세션으로 이 노드 다시] [다른 노드 선택] |
| `blocked` | handoff `status: blocked` 승인 요청 | 승인 화면 대신 `blocked_reason` 표시 + [다음 단계 변경] (recommended_next가 있으면 기본 선택) |
| `out_of_options_recommendation` | `recommended_next`가 허용 목록 밖 | [다음 단계 변경] 메뉴를 열고 추천은 참고로 표시 |
| `delivery_failed` | push/PR 실패 | [다시 시도] [delivery 없이 완료] |
| `session_crashed` | CLI 시작 실패 또는 재개 실패 반복 | 오류 표시 + [다시 시도] [새 세션으로] |
| `setup_failed` | (Work 생성 중) | 생성 대화상자에서 처리 |
| `stale_intent_pending` | 의도 개정이 승인됐는데 재개 노드가 허용 목록 밖 | [다음 단계 변경] |

---

## 4. 내장 검사 (checkRef)

| 검사 | 판정 | 대상 없음(n/a) |
|---|---|---|
| `cmd:<key>` | `project.json checks.<key>`를 worktree에서 실행, 종료 코드 0이면 pass | 키가 없으면 error (P8로 사전 차단) |
| `repro:fails` | 고정된 재현 테스트를 `checks.test_file`로 실행해 **0이 아닌 코드**면 pass | 고정 없음 → **fail** (자동 승인 불가 → 수동) |
| `repro:passes` | 같은 명령이 0이면 pass | 고정 없음/해제됨 → n/a |
| `repro:intact` | 재현 파일의 현재 해시(LF 정규화)가 고정 해시와 같으면 pass | 고정 없음/해제됨 → n/a |
| `tests:unchanged` | `base_commit..HEAD` diff에서 `test_globs`에 걸리는 **기존 파일**의 수정/삭제가 없으면 pass. 새 테스트 파일 추가는 허용 | — |
| `tree:clean` | `git status --porcelain`(relay 제외 파일 빼고)이 비어 있으면 pass | — |
| `diff:within_limit` | `base_commit..HEAD` 변경 줄 수와 파일 수가 config 한도 이내 | — |

- **n/a는 pass로 친다.** `repro:fails`만 예외로 고정이 없으면 fail이다(재현 테스트 없이 evidence를 자동 승인하지 않기 위함).
- **결과 캐시:** `(check, HEAD 커밋, tree:clean 여부)`가 같으면 이전 결과를 재사용한다(`cached: true`). 그래서 fix의 auto_checks에서 돌린 `cmd:test`를 바로 뒤 `g-tests`가 다시 돌리지 않는다. worktree가 깨끗하지 않으면 캐시하지 않는다.
- **동시 실행:** `config.checks.serialize_per_project`가 true면 프로젝트 단위 큐로 하나씩 실행한다.
- 로그: `tasks/<nn>-<node>/checks/<check 이름>.log`. 게이트 실패 시 끝 `log_tail_lines`줄이 다음 task에 주입된다.

### 4.1 재현 테스트 고정 (repro lock, D23)

evidence step의 handoff에 `repro.kind: test`가 있으면, 승인 평가 전에 앱이 다음을 수행한다.

```
lockRepro(step, handoff):
  if project.checks.test_file 없음        → repro.lock_failed(no_test_file_command); return
  f = handoff.repro.file
  if f가 worktree에 없음                   → lock_failed(file_missing); return
  if git status에 f가 수정/미추적 상태      → lock_failed(not_committed); return
  r = run(test_file, {file: f}, timeout)
  if r.timeout                             → lock_failed(timeout); return
  if r.exit_code == 0                      → lock_failed(passed_unexpectedly); return
  work.repro_lock = { file: f, sha256: hashLF(f), commit: HEAD, fail_exit_code: r.exit_code, locked_by_step }
  emit repro.locked
```

- 고정 실패는 오류가 아니다. `repro:fails`가 fail이 되어 수동 승인으로 넘어가고, 승인 화면에 실패 이유를 보여 준다.
- 고정은 Work에 하나다. evidence가 다시 실행되어 새로 고정하면 이전 고정을 대체한다.
- [재현 테스트 고정 해제]는 사용자만 할 수 있다(`repro.released`). 테스트 자체가 틀렸다고 판단될 때 쓴다.
- 한계: "올바른 이유로 실패하는가"(예: import 오류로 실패)는 앱이 판단할 수 없다. 그래서 rca 승인 화면에 고정된 테스트 파일과 실패 출력 끝부분을 함께 보여 주어 사람이 확인한다(rca는 manual).

---

## 5. 엔진 의사 코드

### 5.1 다음 노드 결정

```
defaultNext(nodeId):
  i = index(nodeId)
  for n in nodes[i+1:]:
    if n.when is None or evalWhen(n.when, intent): return n.id
    recordSkipped(n)                       # step state: skipped
  return None                              # 마지막 노드 뒤 → 없음 (P3 때문에 실제로는 g-done에서 끝남)

allowedNext(nodeId):                       # next-options 제공자와 메뉴 '허용된 전이'가 같은 함수를 씀
  return [defaultNext(nodeId)] ∪ transitions.get(nodeId, [])   # 순서: 기본 먼저

evalWhen(expr, intent):                    # 임의 코드 실행 없음. 토큰 단위 파서
  for cond in split(expr, " and "):
    field, op, rhs = parse(cond)           # intent.<field> (==|!=|in) literal
    v = intent.frontmatter[field]
    ok = (op=="==" and v==rhs) or (op=="!=" and v!=rhs) or (op=="in" and v in rhs)
    if not ok: return False
  return True
```

`intent`가 아직 승인 전이면(intake 직후) `when`은 intake 이후 노드에서만 평가하므로 문제가 없다. g-intent 통과 시점의 intent로 평가한다.

### 5.2 skill step 승인 후

```
onApproved(step, handoff, by):
  rec = handoff.recommended_next
  if work.cursor.detour:                   # 임시 노드였음
    next = askUser(["원래 위치로 복귀: " + detour.return_to, "다른 노드 선택"])
    work.cursor.detour = None
  elif rec is None or rec.node == defaultNext(step.node_id):
    next = defaultNext(step.node_id)
  elif rec.node in allowedNext(step.node_id):
    next = rec.node                        # 수동 승인 화면에서 사용자가 이미 확인함(6절: 비기본 추천은 자동 승인 금지)
  else:
    enterAttention(out_of_options_recommendation); return
  step.approval.next_node = next
  appendDecisions(handoff)                 # decisions.md에 추가 (design.md 6.3)
  counters.stop_validation_feedback = 0
  counters.consecutive_auto_approvals = (by=="auto") ? +1 : 0
  if step.node_id in stale_artifacts의 노드: 해당 항목 제거
  endSession(step)                         # kill_on_approval
  emit task.approved
  if by == "human" and next == defaultNext(step.node_id) and node(next).gate == "human":
    enter(next); gatePassed(node(next), by="human")   # 연속 수동 승인 합치기 (D37): 한 번 클릭, 기록은 두 개
  else:
    enter(next)
```

**연속 수동 승인 합치기 (D37):** 사람이 승인한 skill step 바로 다음이 기본 경로의 human 게이트면, 같은 클릭으로 그 게이트도 통과시킨다. 버튼 문구가 게이트 기준으로 바뀐다(intake 승인 → [의도 승인], verify 승인 → [Work 완료]). 게이트의 사전 조건(intent 초안 검증, delivery의 `tree:clean`)이 실패하면 합치지 않고 버튼을 비활성화한다. 사람이 ▾로 다른 노드를 고르면 합치지 않는다. 자동 승인에는 적용하지 않으므로 의도 승인과 Work 완료는 여전히 항상 사람이 누른다.

`blocked` handoff는 승인 대상이 아니다. `needs_attention(blocked)`로 가고, 사용자가 고른 노드로 `reroute(..., group=recommended|transition|other)` 한다.

### 5.3 노드 진입

```
enter(nodeId, reason="default"):
  n = node(nodeId)
  if n.skill:
    if liveSessions() >= config.sessions.max_live: work.state = paused(session_limit); queue(work); return
    openSkillStep(n, reason)               # 컨텍스트 조립 → 세션 시작 (design.md 6.4)
  elif n.gate == "check":
    step = openGateStep(n); results = runChecks(n.run)
    if all(r in {pass, n/a}): gatePassed(n)
    else: gateFailed(n, results)
  elif n.gate == "human":
    openGateStep(n, state=waiting_human)   # UI가 승인 화면을 띄움
```

### 5.4 게이트 결과

```
gatePassed(n, by="app"):
  counters.gate_failures[n.id] = 0
  for action in n.on_pass: run(action)     # intent.approve / work.deliver / work.complete
  emit gate.passed {by}
  if "work.complete" not in n.on_pass: enter(defaultNext(n.id))

gateFailed(n, results):
  k = counters.gate_failures[n.id] += 1
  limit = n.max_consecutive_failures ?? config.gates.max_consecutive_failures
  emit gate.failed {consecutive: k, on_fail: n.on_fail, halted: k >= limit}
  if k >= limit: enterAttention(gate_failure_limit); return
  enter(n.on_fail, reason="gate_failure")  # gate-failure 제공자가 results 로그 끝부분을 주입
```

### 5.5 경로 변경 (사용자)

```
reroute(target, group, temporary=False):
  cur = currentStep()
  duringTask = cur.kind=="skill" and cur.state in {running, awaiting_approval, ended_no_handoff, interrupted}
  if duringTask: cur.state = abandoned; endSession(cur)     # 산출물 보존
  if cur.kind=="gate" and cur.state==waiting_human: cur.state = abandoned
  missing = unmetRequires(target)                           # 경고만, 막지 않음
  if group == "other":                                      # 파이프라인에 없는 스킬
    work.cursor.detour = { return_to: cur.node_id }
    target = "x-" + skill
  emit task.rerouted { from_node: cur.node_id, to_node: target, group, temporary, during_task: duringTask, missing_requires: missing }
  enter(target, reason="user_reroute" | "detour")
```

- 임시 노드(`x-<skill>`)는 approval `manual`, requires 없음, next-options는 "원래 위치로 복귀" 하나다.
- `g-intent`, `g-done`으로의 직접 이동은 메뉴에 표시하지 않는다(의도 변경은 [의도 수정], 완료는 verify를 거침).

### 5.6 의도 승인과 Work 완료

```
action intent.approve:                     # g-intent 통과
  draft = latest approved intake step의 intent.draft.md
  validateIntent(draft)                    # 실패하면 게이트 승인 버튼 비활성 (UI에서 사전 검증)
  intent.version = work.intent_version + 1; write works/<id>/intent.md
  work.intent_version = intent.version; work.title = intent.title
  emit intent.approved

action work.deliver:                       # g-done 통과 시, 완료 전에
  mode = intent.delivery
  if mode == none: work.delivery = {mode, status: skipped}; return
  require tree:clean                       # 아니면 게이트 승인 버튼 비활성
  git push -u <remote> relay/<work-id>
  if mode == pr: gh pr create --base <pr_base> --head relay/<work-id> --title <pr_title> --body-file <pr_body> [--draft]
  성공 → delivery.succeeded / 실패 → delivery.failed, enterAttention(delivery_failed), work.complete 중단

action work.complete:
  work.state = completed; cursor.node_id = None; emit work.completed
```

### 5.7 의도 개정

```
startIntentRevise(trigger):               # trigger: handoff.intent_deviation | 사용자 [의도 수정]
  reroute("x-intent-revise", group="other") 와 같되 detour.return_to를 쓰지 않음
onIntentReviseApproved(handoff):
  rev = handoff.intent_revision
  move intent.md → intent.history/v<N>.md; write draft as intent.md (version N+1)
  work.stale_artifacts ∪= rev.stale_artifacts
  emit intent.revised
  if rev.resume_node가 존재하는 노드이고 g-intent/g-done이 아님: enter(rev.resume_node, reason="resume_after_revise")
  else: enterAttention(stale_intent_pending)
```

- 개정 후 `size`가 바뀌면 이후 `when` 평가가 새 값을 따른다(예: S → M이면 fix에서 rca로 돌아갈 수 있음).
- stale 산출물은 컨텍스트에 `stale: true`로 표시되어 주입되고, 해당 노드가 다시 승인되면 목록에서 빠진다.

---

## 6. 자동 승인 평가

`approval: auto_if_checks`인 skill step이 `awaiting_approval`이 될 때마다 평가한다.

```
evaluateAuto(step, handoff):
  blocking = []
  if config.approval.max_consecutive_auto == 0:                      blocking += "자동 승인 꺼짐"
  if counters.consecutive_auto_approvals >= max_consecutive_auto:    blocking += "연속 자동 승인 상한"
  if not handoff.valid:                                              blocking += "handoff 형식 오류"
  if handoff.status != awaiting_approval:                            blocking += "blocked"
  if handoff.open_questions:                                         blocking += "열린 질문"
  if handoff.intent_deviation:                                       blocking += "의도 이탈"
  if any(d.requires_human and d.by=="ai" for d in decisions):       blocking += "사람이 정할 결정을 AI가 정함"
  if handoff.recommended_next and rec.node != defaultNext(node):     blocking += "기본 경로가 아닌 추천"
  if step.session.last_stop_at <= handoff.mtime:                     blocking += "턴 종료 신호 없음"
  if manifest.writes_code and not tree:clean:                        (auto_checks에 포함되지 않았어도) blocking += "커밋 안 된 변경"
  if work.stale_artifacts 비어 있지 않음:                              blocking += "의도 개정 후 재검토 대기"
  if node.skill == "evidence": lockRepro(step, handoff)              # 4.1
  results = runChecks(node.auto_checks)                              # 캐시 사용
  blocking += [r.check for r in results if r.result not in {pass, n/a}]
  emit approval.evaluated { eligible: blocking==[], blocking, checks: results }
  if blocking == []: startCountdown(config.approval.countdown_sec)
```

- 카운트다운 중 조건이 바뀌면(handoff 수정, 새 커밋) 취소하고 다음 Stop에서 재평가한다.
- 평가 결과는 승인 패널에 조건별 ✓/✕로 표시한다. 자동 승인이 안 되는 이유가 항상 보인다.
- 수동 승인은 blocking과 관계없이 가능하다(형식 오류만 별도 확인 필요).

---

## 7. 승인 처리 (공통)

```
approve(step, by, forcedInvalid=False):
  step.approval = { by, at: now, forced_invalid, artifact_hashes: sha256(각 artifacts + handoff.md) }
  step.git.end_head = HEAD; step.git.dirty_at_end = !tree:clean
  step.state = approved
  onApproved(step, handoff, by)
```

- 승인 뒤 산출물 파일이 바뀌면(세션을 끄지 않은 경우 등) `artifact.modified_after_approval`을 기록하고 task 탭에 경고를 표시한다. 다음 task에는 승인 시점 해시와 다르다는 사실을 함께 주입한다.

---

## 8. 흐름 예시

**M 크기 정상 경로**

```
t-01 intake(work-start)  running → awaiting_approval → approved(human)   ┐ [의도 승인] 한 번 클릭 (D37)
t-02 g-intent            passed(human)                 [intent.approve → v1] ┘
t-03 evidence            ... repro.locked → auto_checks pass → 15초 → approved(auto)
t-04 rca                 approved(human)  ← 고정된 재현 테스트도 이 화면에서 확인
t-05 fix                 auto_checks: repro:passes, repro:intact, tests:unchanged, cmd:test, tree:clean, diff → approved(auto)
t-06 g-tests             cmd:test(cached), repro:passes(cached), repro:intact → passed
t-07 verify              approved(human)                                  ┐ [Work 완료] 한 번 클릭 (D37)
t-08 g-done              passed [work.deliver(pr) → work.complete]        ┘
```

사람 클릭: 의도 승인, rca 승인, Work 완료 = 3회. S 크기는 의도 승인, Work 완료 = 2회(fix는 자동 승인 조건을 만족할 때).

**S 크기로 시작했는데 원인이 불명확함 (오분류 탈출)**

```
t-01 intake, t-02 g-intent (size: S → evidence, rca는 skipped)
t-03 fix    handoff.recommended_next = { node: rca, reason: "증상과 코드가 맞지 않음" }
            → 비기본 추천이므로 수동 승인. 사용자가 승인 → rca
t-04 rca    requires evidence/evidence.md? (선택 입력이라 경고 없음)
            handoff.recommended_next = { node: evidence } ... (transitions rca: [evidence])
```

필요하면 사용자가 [의도 수정]으로 size를 M으로 바꾼다. 바꾸지 않아도 경로는 진행된다.

**게이트 연속 실패**

```
t-05 fix → t-06 g-tests failed(1) → t-07 fix(reason: gate_failure, 실패 로그 주입)
→ t-08 g-tests failed(2) → t-09 fix → t-10 g-tests failed(3) → needs_attention(gate_failure_limit)
```
