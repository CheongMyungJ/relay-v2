# 파이프라인 상태 기계

- 계약 버전: v1 (`pipeline.v1`, `work.v1`, `event.v1`), 문서 v0.3
- 이 문서는 앱 메인 프로세스의 `PipelineEngine`이 따르는 규칙이다. 엔진은 **순수 함수**다: `(work, pipeline, intent, 입력 신호) → (이벤트[], 부수 효과 요청[])`. 상태는 이벤트를 적용해서만 바뀐다. 프로세스 실행, 파일 쓰기, git 호출은 엔진 밖에서 한다(architecture.md 2절).
- v1은 **단일 cursor 순차 실행** 계약이다. 동시에 활성인 step은 Work마다 최대 하나다. 병렬 단계와 합류는 v2에서 계약 버전을 올려 추가한다.

---

## 1. 파이프라인 로드 검증

스키마 검증(`pipeline.v1.schema.json`)에 더해 로드 시 다음을 검사한다. 하나라도 실패하면 그 파이프라인으로는 Work를 만들 수 없다.

| # | 규칙 |
|---|---|
| P1 | 노드 id가 유일하다. `x-`로 시작하는 id는 금지(임시 노드용 예약) |
| P2 | `role: intent`인 skill 노드가 정확히 하나이고 첫 노드다. 바로 다음 노드는 `role: intent_approval`인 human 게이트다 |
| P3 | `role: completion`인 human 게이트가 정확히 하나이고 마지막 노드다 |
| P4 | `intent_approval`, `completion` 게이트에는 `when`을 쓸 수 없다(항상 수동, D7). 두 역할은 각각 한 번만 나온다 |
| P5 | `transitions`의 키와 값, `on_fail`은 존재하는 노드 id다. 대상에 `role: intent` 노드와 human 게이트는 올 수 없다(의도 변경은 intent-revise, 완료는 기본 경로로) |
| P6 | 모든 `skill`이 `<RELAY_HOME>/skills/<name>/relay.json`을 가진다 |
| P7 | `requires`의 `<node-id>/<file>`에서 node-id가 존재하고, 그 노드 스킬의 `produces`에 file이 있다 |
| P8 | `auto_checks`/`run`의 `cmd:<key>`가 `project.json checks`에 있다(Work 생성 시 검사). 없으면 생성 화면에서 명령 등록을 요구한다 |
| P9 | `when` 식이 문법에 맞고 intent 머리글의 필드만 참조한다 |
| P10 | `gate: review` 노드가 있으면 거절한다(v1 미지원) |

**실행 시점 불변 조건** (로드 검증과 별개로 엔진이 매번 강제):

| # | 조건 |
|---|---|
| R1 | `work.intent_version == 0`이면 `role: intent` 노드와 `intent_approval` 게이트 외의 노드에 진입할 수 없다(경로 변경 메뉴도 이 둘과 [Work 포기]만 보인다) |
| R2 | 의도 확정(`intent.approve`)은 `intent_approval` 게이트 통과와 intent-revise 승인에서만 일어난다 |
| R3 | delivery는 `completion` 게이트 통과에서만 일어나고, 순서는 항상 `deliver → complete`다. delivery가 실패하면 complete하지 않는다 |
| R4 | 신호와 검사 결과는 `attempt_id`가 현재 step의 활성 attempt와 같을 때만 반영한다. 다르면 `checks.discarded`/무시로 기록만 한다 |

---

## 2. Work 상태

| 상태 | 뜻 |
|---|---|
| `active` | 진행 중 |
| `needs_attention` | 앱이 다음을 정할 수 없어 사람의 선택이 필요 (`attention.reason`, 3.4절) |
| `paused` | 사용자가 멈춤, 또는 세션 상한 때문에 대기 |
| `completed` | completion 게이트 통과 + delivery 성공(또는 none) |
| `abandoned` | 사용자가 포기 |
| `archived` | [Work 정리]로 worktree 제거 |

| 현재 | 입력 | 다음 | 효과 |
|---|---|---|---|
| (없음) | 생성 + worktree/setup 성공 | `active` | `work.created`, 첫 노드 진입 |
| (없음) | setup 실패 | (생성 취소) | worktree 제거, 로그 표시 |
| `active` | 3.4절 조건 | `needs_attention` | `work.needs_attention`, 알림 |
| `needs_attention` | 사용자가 선택지 실행, 또는 조건 해소(예: 새 유효 handoff) | `active` | `work.attention_cleared` |
| `active`/`needs_attention` | [일시 정지] | `paused` | 실행 중 세션·검사 중단(`interrupted`, `checks.discarded`) |
| `paused` | [재개] | `active` | 중단된 step 재개 또는 다음 노드 진입 |
| `active`/`needs_attention`/`paused` | [Work 포기] | `abandoned` | 실행 중 step `abandoned`, 세션·검사 중단 |
| `abandoned` | [포기 취소] | `paused` | worktree가 남아 있을 때만 (`work.reopened`) |
| `active` | completion 통과 → delivery 성공/none | `completed` | `work.completed` |
| `completed`/`abandoned` | [Work 정리] | `archived` | design.md 7.4절 |

`completed`와 `archived`는 되돌리지 않는다.

---

## 3. Step 상태

step = 노드 한 번 실행. skill step은 task(CLI 세션 1개), gate step은 앱이 처리한다. step 안에서 세션 시작·재개와 검사 실행은 각각 새 `attempt_id`를 받는다.

### 3.1 skill step

```
launching → running ⇄ awaiting_approval → approving → approved
               │              │                 │
               │              │                 └ 후보 불일치 → awaiting_approval (세션 없음)
               ├ PTY 종료(handoff 없음) → ended_no_handoff ─[재개]→ running
               ├ PTY 종료(형식 오류 handoff) → awaiting_approval(invalid) ─[재개해 수정]→ running
               ├ 앱 종료/충돌/일시 정지 → interrupted ─[재개]→ running
               └ 경로 변경/포기/의도 개정/다시 시작 → abandoned
```

**턴 종료로 인정하는 Stop:** Stop 입력의 `background_tasks`가 비어 있을 때만 턴 종료로 본다. 백그라운드 작업이 있으면 무시하고 다음 Stop을 기다린다. 다른 Stop 훅이 block해서 에이전트가 계속 일하는 경우는 곧 다음 UserPromptSubmit이 아니라 다음 Stop이 오므로, **승인 확정 직전에 후보를 다시 확인(3.1.2)** 하는 것으로 막는다.

| 현재 | 입력 | 다음 | 비고 |
|---|---|---|---|
| `launching` | spawn 성공 | `running` | `task.started {attempt_id}` |
| `running` | handoff 생성/변경 | `running` | 즉시 검증해 패널에 표시만 |
| `running` | 턴 종료 Stop + 유효 handoff | `awaiting_approval` | 승인 후보 생성(3.1.1), 자동 승인 평가(6절) |
| `running` | 턴 종료 Stop + 형식 오류 + 이번 턴에 handoff가 바뀜 + 되돌림 < 상한 | `running` | Stop 훅 `block`(D21) |
| `running` | 턴 종료 Stop + 형식 오류 + 상한 도달 | `awaiting_approval`(invalid) | 승인 버튼 비활성, [형식 오류 무시하고 승인…] |
| `running` | 턴 종료 Stop + handoff 없음 | `running` | 정상(대화 중) |
| `running` | 턴 종료 Stop + `status: blocked` | `awaiting_approval`(blocked) | 세션이 살아 있으면 needs_attention으로 가지 않는다. 기본 행동은 "터미널에서 정보를 주고 계속"(3.4) |
| `awaiting_approval` | UserPromptSubmit (프롬프트 제출) | `running` | `task.input`, 후보 폐기 `new_input`, 카운트다운 취소 |
| `awaiting_approval` | handoff·산출물·HEAD 변경 | `running` | 후보 폐기, 다음 턴 종료 Stop에서 새 후보 |
| `awaiting_approval` | 터미널 키 입력(제출 전) | (유지) | 카운트다운만 `pause_on_input_sec` 동안 멈춤 |
| `awaiting_approval` | [승인] 또는 자동 승인 | `approving` | 3.1.2 |
| `approving` | 세션 종료 + 후보 일치 | `approved` | `task.approved {후보 전체}` |
| `approving` | 세션 종료 + 후보 불일치 | `awaiting_approval` | 세션 없는 상태. `candidate_discarded(mismatch_on_approve)`, 재검토 요구 |
| `running`/`awaiting_approval` | PTY 종료 + 유효 handoff | `awaiting_approval` | 세션 없이 승인 가능(자동 승인은 안 함: 턴 종료 Stop이 없으므로) |
| `running` | PTY 종료 + 형식 오류 handoff | `awaiting_approval`(invalid) | Work `needs_attention(handoff_invalid_exit)`: [재개해 수정] [형식 오류 무시하고 승인…] |
| `running` | PTY 종료 + blocked handoff | `awaiting_approval`(blocked) | `needs_attention(blocked_exit)`: [재개해 정보 제공] [다음 단계 선택] |
| `running` | PTY 종료 + handoff 없음 | `ended_no_handoff` | `needs_attention(handoff_missing)` |
| (살아 있는 모든 상태) | 경로 변경, 포기, 의도 개정, [새 세션으로 다시] | `abandoned` | 세션 종료, 산출물 보존, 유효 handoff의 `rejected`를 이벤트에 보존(D35) |
| `ended_no_handoff` | [세션 재개해 마무리] | `running` | `claude --resume <id> "/relay-close"`, 새 attempt |
| `interrupted` | [재개] | `running` | 공통 실행 옵션으로 `--resume`, 새 attempt, `input_generation` +1 |

#### 3.1.1 승인 후보 (C1)

턴 종료 Stop에서 handoff가 유효하면 앱이 후보를 만든다.

```
candidate = {
  candidate_id, input_generation,                  # 현재 입력 세대
  handoff_sha256, artifact_hashes,                 # handoff.artifacts 각각
  head, clean,                                     # git HEAD, tree:clean
  intent_version,
  config_fingerprint                               # auto_checks에 쓰일 실제 명령·cwd·env, repro lock, diff 한도의 해시
}
```

후보는 다음 중 하나가 일어나면 폐기된다: 프롬프트 제출(입력 세대 증가), 세션 재개, handoff·산출물·HEAD·worktree 상태 변경, 프로젝트 check 설정 변경. 폐기되면 다음 턴 종료 Stop에서 새로 만든다. UI의 승인 버튼과 카운트다운은 항상 현재 후보 id를 들고 있고, 표시 중인 후보와 다르면 클릭은 거절된다.

#### 3.1.2 승인 확정 순서

```
confirmApproval(step, candidateId, by, opts):     # opts: merge_gate, next_node, forced_invalid
  require step.candidate.candidate_id == candidateId
  step.state = approving
  killSession(step, wait=true)                    # 프로세스 트리 종료 완료까지 대기
  now = captureCandidate(step)                    # 해시·HEAD·clean 다시 계산
  if now != step.candidate (input_generation 제외):
      emit approval.candidate_discarded(mismatch_on_approve)
      step.state = awaiting_approval; step.candidate = now 기반 새 후보(자동 승인 대상 아님)
      return
  emit task.approved { by, candidate_id, handoff_sha256, artifact_hashes, head, clean, intent_version,
                       next_node, merged_gate, forced_invalid, decisions, rejected }
  onApproved(step, opts)
```

세션을 먼저 끝내므로, 확인과 기록 사이에 에이전트가 파일을 바꿀 수 없다. `decisions.md`와 rejected-log는 `task.approved` payload에서 재생성한다(파일 직접 추가 없음).

### 3.2 gate step

| 게이트 | 흐름 |
|---|---|
| `check` | `running` → 모든 `run` 검사가 pass/n/a면 `passed`, 아니면 `failed` → `needs_attention(check_failed)`. 자동으로 되돌아가지 않는다(D38). `on_fail`은 선택지의 기본값으로만 쓴다 |
| `human` | `waiting_human` → [승인] 시 `passed`. 역할(`role`)에 따른 효과를 실행 |
| (공통) | `when`이 거짓이면 실행하지 않고 `skipped`로 기록 |

기본 bugfix 파이프라인에는 check 게이트가 없다. 검사는 fix의 승인 조건(`auto_checks`)으로 세션이 살아 있을 때 돌고, 실패하면 같은 세션에서 고친다. check 게이트는 세션 없이 앱이 검사만 해야 하는 다른 유형을 위해 계약에 남겨 둔다.

### 3.3 step 번호와 디렉터리

- `seq`는 Work 안에서 1부터 증가하고 skill/gate 공통이다. `step_id = t-<seq 2자리>`, 디렉터리 = `tasks/<seq 2자리>-<node_id>/`.
- `skipped` step은 디렉터리 없이 work.json에만 기록한다. 기록 시점은 실제로 이동을 확정할 때 한 번이다(5.1).
- 같은 노드를 다시 실행하면 새 step이다. `requires`의 `fix/...`는 그 노드의 **가장 최근 approved step**을 가리킨다. 그런 step이 없으면 임시 노드 `x-<같은 스킬>`의 최근 approved step을 찾는다(임시 노드 결과를 이후 입력으로 연결).

### 3.4 앱이 스스로 정할 수 없는 경우 (`needs_attention`)

기본 행동을 먼저 두고, 경로 변경은 보조로 둔다.

| reason | 조건 | 기본 행동 | 그 밖의 선택지 |
|---|---|---|---|
| `check_failed` | check 게이트 실패 | [on_fail 노드로 (실패 로그 주입)] | [다시 실행] [다른 노드 선택] |
| `handoff_missing` | handoff 없이 CLI 종료 | [세션 재개해 마무리] | [새 세션으로 이 노드 다시] [다른 노드 선택] [handoff 없이 승인…] |
| `handoff_invalid_exit` | 형식 오류 handoff를 남기고 종료 | [재개해 수정] | [형식 오류 무시하고 승인…] [다른 노드 선택] |
| `blocked_exit` | blocked handoff를 남기고 종료 | [재개해 정보 제공] | [추천 노드로] [다른 노드 선택] |
| `out_of_options_recommendation` | 추천 노드가 허용 목록 밖 | [기본 노드로] | [다음 단계 변경] (추천은 참고 표시) |
| `delivery_failed` | push/PR 실패 | [다시 시도] | [delivery 없이 완료] |
| `session_crashed` | CLI 시작·재개 실패 반복 | [다시 시도] | [새 세션으로] |
| `resume_target_invalid` | 의도 개정의 재개 노드가 없거나 허용 안 됨 | [다음 단계 변경] | — |
| `worktree_missing` | worktree가 사라짐 | [브랜치에서 worktree 다시 만들기] | [Work 포기] |

세션이 살아 있는 blocked는 needs_attention이 아니다. 승인 패널이 `blocked_reason`과 "터미널에서 필요한 정보를 알려 주세요"를 먼저 보여 주고, 새 유효 handoff가 오면 평소처럼 승인 대기가 된다.

**형식 오류 무시 승인의 한계:** `forced_invalid`로도 우회할 수 없는 것 — intent 초안의 스키마(의도 승인 불가), repro lock(고정은 유효 handoff에서만), PR delivery의 제목(없으면 intent.title을 쓰고 본문은 verification.md로 대체).

---

## 4. 내장 검사 (checkRef)

| 검사 | 판정 | 대상 없음(n/a) |
|---|---|---|
| `cmd:<key>` | `project.json checks.<key>`를 worktree에서 실행, 종료 코드 0이면 pass | 키 없음은 P8로 사전 차단 |
| `repro:fails` | **이번 step에서** 고정에 성공했으면 pass (4.1) | 이번 step의 고정 없음 → **fail** (수동 승인으로) |
| `repro:passes` | 활성 고정 테스트를 `checks.test_file`로 실행, 0이면 pass | 활성 고정 없음/해제됨 → n/a |
| `repro:intact` | 고정 파일 현재 해시(LF 정규화) == 고정 해시 | 활성 고정 없음/해제됨 → n/a |
| `tests:unchanged` | `base_commit..HEAD`에서 `test_globs` ∪ `check_config_globs`에 걸리는 **기존 파일**의 수정/삭제가 없으면 pass. 새 테스트 파일 추가는 허용 | — |
| `tree:clean` | `git status --porcelain`(relay exclude 제외)이 비어 있으면 pass | — |
| `diff:within_limit` | `base_commit..HEAD` 변경 줄 수·파일 수가 한도 이내 | — |

- n/a는 pass로 친다.
- **캐시 없음.** 검사는 매번 실행한다(v0.2의 D36 철회). g-tests를 없애 중복 실행 원인이 사라졌다.
- 검사는 WorkController 큐 밖에서 비동기로 돌고, 결과는 `attempt_id`를 달고 돌아온다(R4). 경로 변경·일시 정지·포기 시 실행 중 검사는 종료하고 `checks.discarded`를 남긴다.
- 프로젝트별 직렬 실행(`checks.serialize_per_project`)은 앱이 돌리는 검사끼리만 조정한다. 에이전트가 CLI에서 돌리는 테스트와의 자원 충돌은 `RELAY_SLOT` 환경 변수로 프로젝트가 포트·DB를 나누도록 안내한다(I17, 기본값).
- 로그: `tasks/<nn>-<node>/checks/<attempt>/<check>.log`.
- **한계(D43):** 결정론적 검사는 "명령이 이 결과를 냈다"만 보장한다. 테스트 runner 설정을 우회하는 식의 조작은 `check_config_globs` 변경 감지로 줄일 뿐 완전히 막지 못한다. 동일 사용자 권한의 임의 프로세스를 막는 것은 v1 범위 밖이다.

### 4.1 재현 테스트 고정 (repro lock, D23)

스킬 manifest에 `capabilities: [repro_lock]`이 있고 handoff `extensions.repro.kind == test`면, 후보 생성 직후 앱이 수행한다.

```
lockRepro(step, handoff):
  if project.checks.test_file 없음       → repro.lock_failed(no_test_file_command); return
  f = handoff.extensions.repro.file
  if f 없음 / 미커밋                      → lock_failed(file_missing | not_committed); return
  r = run(test_file, {file: f})
  if r.timeout                            → lock_failed(timeout); return
  if r.exit_code == 0                     → lock_failed(passed_unexpectedly); return
  emit repro.locked { file: f, sha256: hashLF(f), commit: HEAD, fail_exit_code, locked_by_step: step.id }
```

- `repro:fails`는 `repro_lock.locked_by_step == 현재 step`이고 파일·해시가 이번 handoff와 일치할 때만 pass다. 이전 고정으로 대신 통과하지 않는다(C4).
- **활성 고정은 evidence step을 승인할 때 정해진다:** 그 step의 고정이 있으면 그것, 없으면(고정 실패 후 수동 승인) 활성 고정 없음. 이전 고정은 `repro_lock_history`로 옮긴다.
- **정당한 테스트 변경(D47):** fix에서 `repro:intact`가 실패하면 승인 패널에 세 선택지를 보인다 — [터미널에서 원복 요청] / [변경된 테스트로 재고정] / [고정 해제]. 재고정은 사람이 변경 diff를 본 뒤 누르며(`repro.relocked`), 새 해시로 `repro:passes`를 다시 확인한다. 이 task는 수동 승인이 된다.
- "올바른 이유로 실패하는가"는 앱이 판단할 수 없다. 고정한 evidence 다음에는 반드시 rca(수동)가 온다(D31, D41).

---

## 5. 엔진 의사 코드

### 5.1 다음 노드 계산 (순수 함수)

```
nextNode(fromNodeId) -> { next, skipped[] }:       # 조회만 한다. 기록하지 않는다
  skipped = []
  for n in nodes after fromNodeId:
    if n.when is None or work.path_escalated or evalWhen(n.when, intent): return { next: n.id, skipped }
    skipped.append(n.id)
  return { next: None, skipped }

allowedNext(nodeId):                                # next-options 제공자와 메뉴가 같은 함수를 씀
  return [nextNode(nodeId).next] ∪ transitions.get(nodeId, [])

moveTo(target, fromNodeId, reason):                 # 이동을 확정할 때만 호출
  if reason == default: record skipped steps from nextNode(fromNodeId).skipped   # 한 번만
  if target의 when이 거짓인데 명시 전이/사용자 선택으로 진입: emit work.path_escalated   # D41
  enter(target, reason)
```

**경로 승격(D41):** `when` 때문에 건너뛰는 노드(예: S의 evidence, rca)에 명시 전이로 들어가면 `path_escalated = true`가 되고, 이후 기본 경로 계산에서 `when`을 무시한다. "S 경로를 벗어나면 끝까지 전체 경로"다. 그래서 S에서 evidence로 돌아가 재현 테스트를 새로 고정하면 다음은 rca(수동 검토)다.

`evalWhen` 문법은 v0.2와 같다(`intent.<field> (==|!=|in) literal`, `and`).

### 5.2 skill step 승인 후

```
onApproved(step, opts):
  if step.node_id == "x-intent-revise": onIntentReviseApproved(step); return        # I6: 명시 분기
  if node(step).capabilities has repro_lock: setActiveReproLock(step)                # 4.1
  clearStale(step.node_id)                                                           # D48
  rec = handoff.recommended_next
  if opts.next_node: next = opts.next_node                                           # 사람이 ▾로 고름
  elif work.cursor.detour: next = detour.return_to (UI가 "원래 위치로 복귀/다른 노드" 확인 후)
  elif rec is None or rec.node == nextNode(step.node_id).next: next = nextNode(...).next
  elif rec.node in allowedNext(step.node_id): next = rec.node                        # 수동 승인 화면에서 확인됨(D29)
  else: enterAttention(out_of_options_recommendation); return
  counters.consecutive_auto_approvals = (by=="auto") ? +1 : 0
  counters.stop_validation_feedback = 0
  if opts.merge_gate and node(next).gate == "human" and next == nextNode(step.node_id).next:
    moveTo(next); passHumanGate(node(next), by="human")                              # D37, 명시적 선택
  else:
    moveTo(next, from=step.node_id, reason)
```

- **게이트 합치기는 승인 명령의 명시적 옵션**이다(`merge_gate`). UI의 기본 버튼이 true, "승인만 하고 완료는 나중에"는 false로 보낸다(M4). 자동 승인에는 적용하지 않는다.

### 5.3 노드 진입

```
enter(nodeId, reason):
  R1 검사: intent_version == 0이면 intent/intent_approval 외 거절
  n = node(nodeId)
  if n.skill:
    if liveSessions() >= max_live: emit work.paused(session_limit); queue(work); return
    effect StartSession(new attempt)          # design.md 6.4
  elif n.gate == "check":
    effect RunChecks(n.run, new attempt)      # 결과는 checks_done 신호로 돌아옴
  elif n.gate == "human":
    open gate step (waiting_human)
```

### 5.4 게이트 결과

```
onChecksDone(step, attempt, results):
  if attempt != step.active_attempt: emit checks.discarded(superseded); return       # R4
  if all(r in {pass, n/a}): emit gate.passed; moveTo(nextNode(n.id).next)
  else: emit gate.failed { suggest: n.on_fail }; enterAttention(check_failed)

passHumanGate(n, by):
  if n.role == intent_approval: intentApprove()                                      # R2
  if n.role == completion: deliverThenComplete(); return                             # R3
  emit gate.passed { by, role }
  moveTo(nextNode(n.id).next)
```

### 5.5 경로 변경 (사용자)

```
reroute(target, group, note=None, reasonRef=None):
  cur = currentStep()
  duringTask = cur.kind == skill and cur.state not in {approved, abandoned}
  if duringTask: endSession(cur); emit task.abandoned { cause: user_reroute, rejected: 유효 handoff의 rejected }
  if cur.kind == gate: stop checks (checks.discarded) / abandon waiting_human
  missing = unmetRequires(target)            # 경고만
  if group == other: work.cursor.detour = { return_to: cur.node_id }; target = "x-" + skill
  emit task.rerouted { from_node, to_node, group, during_task, missing_requires: missing, reason_ref, note }
  moveTo(target, reason = user_reroute | detour)
```

- 임시 노드는 approval `manual`, requires 없음, next-options는 "원래 위치로 복귀" 하나.
- R1 때문에 의도 승인 전에는 메뉴에 [intake 다시]와 [Work 포기]만 있다.

### 5.6 의도 승인과 Work 완료

```
intentApprove():                                     # intent_approval 게이트 통과
  draft = role:intent 노드의 최근 approved step의 intent.draft.md
  require validateIntent(draft) 오류 없음            # 실패하면 버튼 비활성 (경고는 통과)
  emit intent.approved { version: intent_version + 1, title, size, delivery }
  (적용: intent.md 쓰기, work.intent_version, work.title)

deliverThenComplete():                               # completion 게이트 통과
  mode = intent.delivery
  if mode != none:
    require tree:clean                               # 아니면 버튼 비활성
    runId = new; emit delivery.started { run_id, mode, head, remote, base }
    git push -u <remote> relay/<work-id>
    if mode == pr: 같은 head 브랜치의 열린 PR이 있으면 재사용, 없으면 gh pr create …
    성공 → emit delivery.succeeded / 실패 → emit delivery.failed; enterAttention(delivery_failed); return
  emit gate.passed { role: completion }; emit work.completed
```

복구 시 `delivery.started`만 있고 결과가 없으면: 원격 브랜치 HEAD와 기존 PR을 조회해 완료된 단계는 건너뛰고 이어서 수행한다.

### 5.7 의도 개정

```
startIntentRevise(trigger):     # handoff.intent_deviation에서 [의도 수정] | 사용자 [의도 수정]
  현재 step이 살아 있으면 abandon(cause: intent_revise)
  enter("x-intent-revise", reason=intent_revise)     # detour 아님

onIntentReviseApproved(step):
  rev = handoff.extensions.intent_revision
  require validateIntent(rev.draft)
  emit intent.revised { from_version, to_version, title, stale_artifacts: rev.stale_artifacts, resume_node }
  (적용: intent.md → intent.history/v<N>.md, 초안 → intent.md, intent_version, title, stale_artifacts)
  if rev.resume_node가 존재하고 human 게이트/intent 노드가 아님: moveTo(rev.resume_node, reason=resume_after_revise)
  else: enterAttention(resume_target_invalid)
```

- 개정으로 `size`가 바뀌면 이후 `when`이 새 값을 따른다. `path_escalated`는 유지한다.
- stale 처리(D48): `review` 상태 산출물은 그것을 `requires`로 쓰는 노드의 자동 승인만 막는다. `obsolete`는 이후 컨텍스트에서 빠진다. 해당 노드가 다시 승인되면 목록에서 제거한다.

---

## 6. 자동 승인 평가

`approval: auto_if_checks`인 skill step에서 후보가 생길 때마다 평가한다.

```
evaluateAuto(step, candidate, handoff):
  blocking = []
  if config.approval.max_consecutive_auto == 0 or consecutive >= max: blocking += "연속 자동 승인 상한"
  if not handoff.valid:                         blocking += "handoff 형식 오류"
  if handoff.status == blocked:                 blocking += "blocked"
  if handoff.open_questions:                    blocking += "열린 질문"
  if handoff.intent_deviation:                  blocking += "의도 이탈"
  if any(d.requires_human for d in decisions):  blocking += "사람이 정할 결정 포함"        # I3: by와 무관
  if rec and rec.node != nextNode(node).next:   blocking += "기본 경로가 아닌 추천"
  if manifest.writes_code and not candidate.clean: blocking += "커밋 안 된 변경"
  if any(s.status == review and s.ref in node.requires for s in stale): blocking += "재검토 필요한 입력"   # D48
  if manifest.capabilities has repro_lock: lockRepro(step, handoff)
  results = runChecks(node.auto_checks, attempt)                                      # 비동기, R4
  blocking += [r.check for r in results if r.result not in {pass, n/a}]
  emit approval.evaluated { candidate_id, eligible: blocking == [], blocking, checks: results }
  if blocking == [] and candidate still current: startCountdown(candidate_id)
```

- 카운트다운이 끝나면 `confirmApproval(step, candidate_id, by=auto)`(3.1.2). 그 사이 후보가 폐기됐으면 아무것도 하지 않는다.
- 조건별 결과는 승인 패널에 "원인 → 할 일" 형태로 보인다(ui.md 2.5).
- 수동 승인은 blocking과 관계없이 가능하다. 에이전트 표기(`by: human`)는 사람 승인 증거가 아니며, 사람의 확정은 수동 승인 기록 자체다.

---

## 7. 흐름 예시

**M 크기 정상 경로**

```
t-01 intake(work-start)   awaiting_approval → approved(human, merge_gate)  ┐ [의도 승인] 1클릭
t-02 g-intent             passed(human, intent v1)                          ┘
t-03 evidence             repro.locked(t-03) → auto_checks pass → 카운트다운 → approved(auto)
t-04 rca                  approved(human)   ← 고정 테스트와 실패 출력을 이 화면에서 확인
t-05 fix                  auto_checks pass → 카운트다운 → approved(auto)
t-06 verify               approved(human, merge_gate)                      ┐ [Work 완료] 1클릭
t-07 g-done               delivery(pr) → work.completed                    ┘
```

**fix 중 테스트 실패** — 같은 세션 안에서 해결한다(새 step 없음).

```
t-05 fix  후보 A: cmd:test fail → 자동 승인 안 됨, 패널에 실패 로그
          사용자가 터미널에 "테스트 실패 고쳐줘" 제출 → 후보 A 폐기 → 에이전트 수정·커밋·handoff 갱신
          턴 종료 → 후보 B: 모두 pass → 카운트다운 → approved(auto)
```

**S로 시작했는데 원인이 불명확함**

```
t-01/t-02 (size S → evidence, rca skipped)
t-03 fix   recommended_next = evidence → 수동 승인 → 경로 승격(path_escalated)
t-04 evidence  repro.locked → approved(auto)
t-05 rca       (승격 때문에 when 무시) approved(human)
t-06 fix → t-07 verify → t-08 g-done
```
