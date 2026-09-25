# relay-v2 설계 문서

- 상태: 초안 (v0.1.1)
- 범위: v1 (MVP)

---

## 1. 개요

relay-v2는 코딩 에이전트 CLI(Claude Code, 이후 Codex)를 **앱 안의 터미널에 그대로 띄우고**, 그 바깥에 **작업 단위(work/task) 관리, 단계별 스킬, 사람 승인 게이트, 인수인계**를 얹는 데스크톱 앱이다.

CLI의 사용성은 CLI 자체가 제공한다. relay는 CLI를 다시 구현하지 않고, **task 경계에서만** 개입한다.

### 1.1 목표

- 사람의 의도를 먼저 정돈하고(`work-start`), 그 의도를 기준으로 작업을 단계별로 진행한다.
- 각 단계(task)는 **새 CLI 세션**에서 실행된다. 이전 단계의 결과는 구조화된 산출물과 인수인계(handoff)로 전달한다.
- 단계 사이의 진행 여부는 **앱이 결정론적으로** 판단한다(파이프라인 상태 기계 + 게이트).
- 이후 지식 추출/주입, 게이트 추가를 **설정과 템플릿 수정만으로** 확장할 수 있게 한다.

### 1.2 비목표

- 헤드리스 스트림을 파싱해 CLI UI를 재구현하지 않는다.
- **task 내부 게이트를 두지 않는다.** 세션 도중의 통제는 CLI의 자체 권한 체계에 맡긴다.
- 실행 중인 세션에 텍스트를 주입하지 않는다(PTY 쓰기 자동화 없음). 개입은 세션 시작 시점에만 한다.
- v1에서는 병렬 task를 지원하지 않는다. 한 work 안의 task는 순차 실행한다.

---

## 2. 확정된 결정

| # | 결정 | 이유 |
|---|---|---|
| D1 | CLI를 PTY로 실행하고 xterm.js로 앱에 임베드 | CLI 사용성을 그대로 얻고, 벤더 업데이트를 따라갈 필요가 없음 |
| D2 | 구조화된 정보는 옆 채널(훅, 산출물 파일, git)로 받음. 터미널 화면은 파싱하지 않음 | 화면 출력은 ANSI 렌더링일 뿐이라 신뢰할 수 없음 |
| D3 | 스킬이 **산출물과 handoff 초안을 먼저 작성**하고 승인을 요청. 승인은 앱이 파일 상태를 바꾸는 방식 | 사람이 대화가 아니라 산출물을 승인함. 버튼을 누른 뒤 세션에 명령을 주입할 필요가 없음 |
| D4 | 게이트는 앱이 소유. 스킬은 일과 산출물만 담당 | 게이트를 추가/변경할 때 스킬을 수정하지 않기 위함 |
| D5 | 다음 task는 파이프라인 템플릿(상태 기계)이 결정. handoff의 `recommended_next`는 허용된 전이 안에서만 반영 | 앱이 또 하나의 LLM이 되지 않도록 |
| D6 | 의도(intent)는 버전을 관리하며 모든 task에 주입 | 방향 유지, 의도 변경 추적 |
| D7 | 자동 승인은 에이전트의 말이 아니라 외부에서 결정론적으로 확인되는 조건으로만 판단 | 조기 종료(premature completion) 방지 |
| D8 | 데스크톱 프레임워크: **Electron** | node-pty + xterm.js 조합이 가장 검증됨 (VS Code와 같은 구성). Windows ConPTY 지원 |
| D9 | v1 벤더: **Claude Code만**. Codex는 스파이크 결과에 따라 결정 | 연동 깊이 확보를 우선 |
| D10 | 산출물 저장소는 **레포 밖의 중앙 저장소**. 프로젝트/워크별 디렉터리로 구분 | work마다 git worktree를 쓰므로, 레포 안에 두면 워크트리 삭제 시 함께 사라짐. 레포에 잡음도 남기지 않음 |
| D11 | 첫 파이프라인: **버그 수정** | 짧고 완료조건이 명확해서 구조의 효과를 가장 빨리 검증할 수 있음 |
| D12 | 1차 지원 플랫폼: **Windows 네이티브** (macOS/Linux도 동작하도록 작성) | 주 사용 환경 |
| D13 | worktree 기본 위치는 **중앙 저장소 아래** | 산출물과 작업 공간을 한곳에서 관리 |
| D14 | 스킬은 파이프라인을 모른다. 이 노드에서 허용되는 다음 스킬 목록은 앱이 주입한다 | 파이프라인을 바꿀 때 스킬을 수정하지 않기 위함 (D4와 같은 원칙) |
| D15 | 브랜치 처리(push/PR)는 intent의 완료조건에 포함될 때만 한다. 코드를 수정하는 work라면 `work-start`가 이를 묻고 초안에 넣는다 | 외부로 나가는 동작은 사람이 의도한 경우에만 |
| D16 | 완료/포기한 Work는 [Work 정리] 버튼으로 worktree를 제거한다. 산출물은 보존한다 | 디스크와 브랜치 목록 정리. 기록은 남김 |

---

## 3. 개념 모델

```
Project (레포 1개)
 └─ Work (하나의 목적, git worktree 1개, 파이프라인 1개)
     ├─ Intent (버전 관리, 모든 task에 주입)
     ├─ Decision log (추가만 하는 결정 기록)
     └─ Task (파이프라인의 스킬 노드 1회 실행 = CLI 세션 1개)
         ├─ Artifacts (산출물: rca.md, evidence.md 등)
         └─ Handoff (진행 상태 + 다음 task용 요약, YAML 머리글)
```

| 용어 | 정의 |
|---|---|
| Project | 등록된 git 레포 하나 |
| Work | 사용자가 달성하려는 하나의 목적. 파이프라인 인스턴스 하나와 git worktree 하나를 가짐 |
| Task | 파이프라인의 스킬 노드를 한 번 실행한 것. CLI 세션 하나에 대응. 완료되면 해당 터미널은 읽기 전용이 됨 |
| Pipeline | 작업 유형별 노드(스킬/게이트) 순서를 정의한 템플릿 |
| Gate | 노드 사이의 통과 조건. `human`, `check`, `review` 세 종류 |
| Artifact | task가 만든 결과물 파일. 원본으로 영속되며 이후 task가 경로로 참조 |
| Handoff | task의 진행 상태와 다음 task에 넘길 요약. 앱이 스키마로 검증 |

---

## 4. 핵심 흐름

```
[사용자] Project 선택 → Work 생성
   ↓
[앱] git worktree 생성 → 저장소 디렉터리 생성 → 파이프라인 인스턴스 시작
   ↓
┌─▶ [앱] 다음 노드 결정 (상태 기계)
│     ├─ skill 노드:
│     │    1) 컨텍스트 조립 (intent, decisions, 직전 handoff, 필요 산출물, 게이트 정책)
│     │    2) PTY로 `claude` 실행 (첫 프롬프트 = 스킬 호출 + 조립된 컨텍스트)
│     │    3) 사용자가 터미널에서 에이전트와 작업
│     │    4) 스킬이 산출물 + handoff(status: awaiting_approval) 작성 → 승인 요청
│     │    5) 앱이 handoff 감지 → 스키마 검증 → 패널에 산출물 표시
│     │    6) 사용자가 [Task 완료] 클릭 (또는 자동 승인 조건 충족)
│     │    7) 앱이 status → approved, task 터미널 읽기 전용, `task.approved` 발행
│     └─ gate 노드: human / check / review 실행 → 통과 시 진행, 실패 시 지정 노드로 복귀
└─── 반복
   ↓
[앱] final-verify 스킬 실행 → (intent.delivery가 있으면 deliver 스킬) → 사용자 [Work 완료] → `work.completed`
   ↓
[사용자] [Work 정리] → worktree 제거 → `work.cleaned`
```

### 4.1 반려, 되돌아가기, 경로 변경

승인 전 수정 요청은 같은 세션에서 대화로 처리한다(에이전트가 산출물 파일을 고침). 그 밖에 다음 노드가 바뀌는 경우는 세 가지다.

**(1) 게이트 실패 → 자동 복귀**

- 파이프라인 노드의 `on_fail`에 지정한 노드로 돌아가 **새 task**를 연다.
- 실패 정보(실행한 명령, 종료 코드, 출력 끝부분)는 `gate-failure` 컨텍스트 제공자가 새 task에 주입한다.
- 같은 게이트가 연속으로 실패하면(기본 3회) 자동 복귀를 멈추고 사용자를 부른다.

**(2) 최종검증 실패 → 되돌아갈 노드 추천**

- `final-verify`의 handoff에 있는 `recommended_next`(예: `fix`)가 파이프라인의 `transitions`에 허용된 노드면 그 노드로 돌아간다.

**(3) 사용자가 직접 선택**

task와 task 사이, 그리고 task 진행 중에도 [다음 단계 변경] 메뉴를 쓸 수 있다. 메뉴는 세 그룹으로 보여 준다.

| 그룹 | 내용 | 선택 시 동작 |
|---|---|---|
| 기본 | 파이프라인의 다음 노드 | 정상 진행 |
| 허용된 전이 | `transitions`에 정의된 노드 (예: rca → evidence) | 해당 노드로 이동 |
| 기타 스킬 | 등록된 모든 스킬 | **임시 노드**로 끼워 넣음. 끝나면 "원래 위치로 복귀 / 다른 노드 선택"을 묻는다 |

- 선택한 스킬의 `requires`(필요 산출물)가 아직 없으면 경고를 표시한다. 진행은 막지 않는다.
- task 진행 중에 경로를 바꾸면 현재 task는 `abandoned` 상태가 되고 터미널은 읽기 전용이 된다. 작성 중이던 산출물은 보존한다.
- 모든 경로 변경은 `task.rerouted` 이벤트로 기록한다. 나중에 파이프라인 템플릿을 개선하는 근거가 된다(자주 쓰는 우회 경로 → 정식 전이로 승격).

### 4.2 의도 개정 (`intent-revise`)

의도가 바뀌어야 하는 경우는 두 가지다.
- 어떤 task의 handoff에 `intent_deviation`이 기록됨(이 경우 자동 승인 금지)
- 사용자가 직접 [의도 수정]을 요청함

그러면 앱이 `intent-revise` 스킬 task를 끼워 넣는다. 이 스킬이 하는 일은 다음과 같다.

1. **입력:** 현재 intent, 개정 계기(deviation 내용과 근거 산출물), 지금까지의 결정 로그
2. **사람과 논의:** 무엇을 바꿀지(목표 축소, 비목표 추가, 완료조건 수정 등)를 묻고 정리한다.
3. **영향 분석:** 바뀐 의도 때문에 **이미 승인된 산출물 중 무효가 되는 것**을 찾는다. 예를 들어 비목표가 바뀌면 설계를 다시 해야 할 수 있다.
4. **산출물:** 새 버전 intent 초안, 변경 전후 차이, 영향 받는 산출물 목록, 재개할 노드 추천
5. **승인:** 항상 수동이다.

승인되면 앱은 다음을 처리한다.
- intent 버전을 올리고 이전 버전은 `intent.history/`로 옮긴다.
- 영향 받는 산출물에 `stale` 표시를 한다.
- 추천된 노드부터 재개한다. 이후 task에는 최신 intent만 주입한다.

`work-start`와 템플릿을 공유하지만 별도 스킬로 둔다. 처음부터 묻는 것과 차이와 영향을 다루는 것은 대화 흐름이 다르기 때문이다.

### 4.3 Work 완료와 정리

**Work 완료** (`g-done` 게이트, 항상 수동)
- 최종검증 결과를 확인한 사용자가 [Work 완료]를 누른다.
- 브랜치 처리(push/PR)는 intent의 `delivery`가 `none`이 아닐 때만, 완료 전에 `deliver` 스킬 노드에서 처리한다(10절). `delivery: none`이면 브랜치 `relay/<work-id>`는 로컬에 그대로 둔다.

**Work 정리** (완료 또는 포기한 Work에서 활성화)

앱은 먼저 다음을 확인하고, 결과를 요약해서 보여 준다.

| 확인 항목 | 문제가 있을 때 |
|---|---|
| worktree에 커밋하지 않은 변경 | 경고, 사용자가 명시적으로 확인해야 진행 |
| 브랜치의 커밋이 원격이나 기본 브랜치에 없음 | "브랜치는 유지, worktree만 제거"를 기본값으로 선택 |

정리 동작:
- `git worktree remove`로 worktree를 제거한다.
- 브랜치 삭제는 선택 사항이다. 기본값은 **유지**이고, 병합되었거나 push된 경우에만 삭제를 제안한다.
- 중앙 저장소의 산출물(`works/<work-id>/`)은 **삭제하지 않는다.** work 상태만 `archived`로 바꾼다. 산출물은 향후 지식 추출의 원천이다.
- `work.cleaned` 이벤트를 기록한다.

---

## 5. 저장소 구조

### 5.1 중앙 저장소

위치: `<RELAY_HOME>` (기본값 `%USERPROFILE%\.relay`, macOS/Linux는 `~/.relay`)

```
<RELAY_HOME>/
  config.json                         # 앱 전역 설정
  pipelines/                          # 파이프라인 템플릿 (사용자 정의 포함)
    bugfix.yaml
  skills/                             # relay가 배포하는 스킬 원본
    work-start/SKILL.md
    ...
  projects/
    <project-id>/                     # 예: my-api-3f9a2c (레포 이름 + 경로 해시)
      project.json                    # 레포 경로, 기본 브랜치, 테스트 명령 등
      knowledge/                      # (향후) 승인된 지식
      worktrees/
        <work-id>/                    # git worktree (5.2)
      works/
        <work-id>/                    # 예: w-20260925-001
          work.json                   # 상태, 파이프라인, 현재 노드, worktree 경로
          intent.md                   # 최신 의도
          intent.history/             # v1.md, v2.md ...
          decisions.md                # 추가만 하는 결정 로그
          events.jsonl                # 수명주기 이벤트 기록
          tasks/
            01-work-start/
              handoff.md
              context.manifest.json   # 이 task에 무엇이 주입됐는지
            02-evidence/
              evidence.md
              handoff.md
              context.manifest.json
            ...
          verification.md
```

### 5.2 worktree

- 위치: `<RELAY_HOME>/projects/<project-id>/worktrees/<work-id>/` (D13)
- 브랜치: `relay/<work-id>`, 기준은 `project.json`의 기본 브랜치
- work가 완료되어도 worktree는 자동 삭제하지 않는다. 사용자가 [Work 정리]로 제거한다(4.3).
- Windows 경로 길이 제한(260자)에 걸릴 수 있다. 앱이 worktree를 만들 때 해당 레포에 `core.longpaths=true`를 설정한다.

### 5.3 에이전트의 저장소 접근

에이전트는 worktree 안에서 실행되고, 산출물은 레포 밖의 `<RELAY_HOME>/.../works/<work-id>/`에 써야 한다. 이를 위해 다음을 설정한다.
- `claude --add-dir <work 디렉터리>`로 접근을 허용한다.
- worktree의 `.claude/settings.local.json`에서 해당 경로 쓰기 권한을 미리 허용한다.
- 스킬에는 `RELAY_WORK_DIR`, `RELAY_TASK_DIR` 경로를 첫 프롬프트로 전달한다.

→ 스파이크 S3에서 검증한다.

---

## 6. 계약

이 절의 네 가지가 앱, 스킬, 향후 확장이 공유하는 계약이다. 변경할 때는 `schema_version`을 올린다.

### 6.1 Handoff (`tasks/<nn>-<skill>/handoff.md`)

YAML 머리글(앱이 파싱하고 검증) + 본문(사람과 다음 에이전트가 읽음).

```yaml
---
schema_version: 1
work_id: w-20260925-001
task_id: t-03
skill: root-cause
status: awaiting_approval          # awaiting_approval | approved | blocked | needs_rework | abandoned
intent_version: 1
artifacts: [rca.md]                # task 디렉터리 기준 상대 경로
git: { base: a1b2c3d, head: d4e5f6a }
decisions:
  - what: "원인은 토큰 만료 시각 비교의 타임존 불일치"
    why: "재현 로그에서 UTC/로컬 차이 9시간과 정확히 일치"
    by: human                      # human | ai
    requires_human: true           # true인데 by: ai면 자동 승인 금지
assumptions: []
rejected: ["캐시 TTL 문제 가설: 캐시 비활성화 후에도 재현됨"]
open_questions: []                 # 비어 있지 않으면 자동 승인 금지
intent_deviation: null             # 의도와 달라진 점. 있으면 자동 승인 금지
checks: {}                         # 예: { tests: pass, lint: pass } (앱이 재실행해서 확인)
risks: []
recommended_next: { node: fix, reason: "원인 확정" }   # 주입된 next_options 중에서 고름. 없으면 null
knowledge_candidates: []           # 향후 지식 추출 입력
---
## 요약
## 다음 task가 알아야 할 것
```

- JSON Schema: `schemas/handoff.v1.json` (구현 단계에서 작성)
- 앱은 검증에 실패하면 승인 버튼을 비활성화하고 오류를 패널에 표시한다. 수정은 사용자가 같은 세션에서 요청한다.
- `rejected`(시도했으나 기각한 것)는 필수 필드다. 세션 중에 알게 된 부정적 지식을 보존하기 위함이다.

**`recommended_next`의 동작 (D14)**

- 스킬 문서에는 다음 스킬 정보를 넣지 않는다. 스킬은 파이프라인을 모른다.
- 앱이 task를 시작할 때 `next-options` 컨텍스트 제공자가 **이 노드에서 갈 수 있는 노드 목록**을 주입한다. 목록은 파이프라인의 기본 다음 노드와 `transitions`로 만들고, 노드 id와 한 줄 설명을 담는다.
  ```
  이 task 이후 선택 가능한 다음 단계:
  - fix (기본): 확정된 원인을 수정
  - evidence: 증거가 부족하면 수집 단계로 복귀
  ```
- 스킬은 이 중 하나를 고르고 이유를 적는다. 기본 노드로 가면 되는 경우에는 `null`이어도 된다.
- 목록 밖의 노드를 적으면 앱은 자동으로 진행하지 않는다. 사용자에게 [다음 단계 변경] 메뉴를 열어 보여 주고, 그 추천은 참고용으로만 표시한다.

### 6.2 Intent (`intent.md`)

```yaml
---
schema_version: 1
version: 1
type: bugfix                       # bugfix | feature | refactor | analysis
size: M                            # S | M | L (파이프라인 빠른 경로 선택에 사용)
delivery: none                     # none | push | pr (D15)
---
## 목표
## 비목표
## 원하는 결과
## 완료조건        # 검증 가능한 문장만. 최종검증의 채점 기준
## 제약
## 추가 의견
```

- 분량 상한: 본문 약 1,500자. 모든 task에 주입되기 때문이다.
- `work-start` 스킬은 완료조건이 검증 가능한 문장이 될 때까지 되묻는다.
- **`delivery`:** 코드를 수정하는 work(bugfix, feature, refactor)라면 `work-start`가 "작업이 끝나면 push하거나 PR을 만들까요?"라고 묻는다. 답을 들으면 `delivery`와 완료조건에 반영한다(예: "`relay/<work-id>` 브랜치로 PR 생성"). 사용자가 답하지 않으면 초안은 `none`으로 둔다. analysis 유형은 묻지 않고 `none`으로 둔다.

### 6.3 Pipeline (`pipelines/<type>.yaml`)

```yaml
schema_version: 1
id: bugfix
applies_to: { type: bugfix }
nodes:
  - id: intake
    skill: work-start
  - id: g-intent
    gate: human                    # 의도 승인은 항상 수동
  - id: evidence
    skill: evidence
    requires: [intent]
    approval: auto_if_checks       # manual | auto_if_checks
  - id: rca
    skill: root-cause
    requires: [intent, evidence/evidence.md]
    approval: manual
  - id: fix
    skill: fix
    requires: [intent, rca/rca.md]
    approval: auto_if_checks
  - id: g-tests
    gate: check
    run: ["{project.test_command}"]
    on_fail: fix                   # 실패 시 되돌아갈 노드
  - id: verify
    skill: final-verify
    requires: [intent, evidence/evidence.md, rca/rca.md]
  - id: deliver
    skill: deliver
    when: "intent.delivery != 'none'"   # 조건이 거짓이면 건너뜀
    approval: manual               # 외부로 나가는 동작이므로 항상 수동
  - id: g-done
    gate: human                    # Work 완료
transitions:                       # recommended_next로 허용되는 비순차 전이
  rca: [evidence]                  # 증거 부족 시 수집 단계로 복귀 허용
  verify: [fix, rca]
fast_path:
  S: [intake, g-intent, fix, g-tests, verify, deliver, g-done]
```

- `when` 조건은 intent 머리글 필드만 참조할 수 있는 단순 비교식으로 제한한다(임의 코드 실행 금지).

게이트 종류:

| 종류 | 동작 | v1 |
|---|---|---|
| `human` | 사용자 버튼 승인 | ✅ |
| `check` | 앱이 명령을 실행하고 종료 코드로 판정 | ✅ |
| `review` | 별도 세션에서 리뷰 스킬을 실행하고 그 handoff로 판정 (다른 벤더 가능) | 인터페이스만 정의 |

skill 노드의 `approval` 필드는 그 task 자체의 완료 승인 방식이다(7절).

**`check` 게이트의 결정론**

- **판정은 결정론적이다.** 앱이 정해진 명령을 직접 실행하고, 종료 코드 0이면 통과, 아니면 실패로 판정한다. LLM은 판정에 관여하지 않는다.
- 명령은 `project.json`에 등록된 것만 실행한다. 에이전트가 고른 명령이나 handoff에 적힌 명령은 실행하지 않는다. 그래서 에이전트가 판정을 조작할 수 없다.
- 실행 조건: worktree에서 실행, 타임아웃(기본 10분), 출력은 `tasks/<nn>-<gate>/check.log`에 저장.
- **다만 결과 자체는 결정론적이지 않을 수 있다.** 불안정한(flaky) 테스트나 환경 차이 때문이다. 앱은 자동 재시도를 하지 않는다(기본 `retry: 0`). 재시도가 실패를 가릴 수 있기 때문이다. 실패하면 `on_fail` 노드로 돌아가고, 에이전트가 원인을 판단한다.
- **한계:** check는 "명령이 통과했는가"만 보장한다. "올바르게 고쳤는가"는 보장하지 않는다. 예를 들어 에이전트가 테스트를 약하게 고쳐서 통과시킨 경우는 잡지 못한다. 이것은 `final-verify`와 사람 승인의 몫이다. `final-verify`는 diff에서 테스트 파일 변경 여부를 반드시 점검 항목에 넣는다.

### 6.4 수명주기 이벤트 (`events.jsonl`)

```
work.created | work.completed | work.abandoned | work.cleaned
task.started | task.awaiting_approval | task.approved | task.rejected | task.abandoned
task.rerouted
gate.passed  | gate.failed
intent.revised
```

- 모든 이벤트에는 `{ ts, work_id, task_id?, type, payload }`가 들어가며, 파일 기록과 동시에 앱 내부 이벤트 버스로 발행된다.
- 지식 추출, 알림, 통계 같은 부가 기능은 모두 이벤트 구독자로 구현한다.

### 6.5 컨텍스트 제공자

```ts
interface ContextProvider {
  id: string;
  priority: number;                       // 높을수록 먼저 들어가고 늦게 강등됨
  provide(ctx: TaskLaunchContext): Promise<ContextFragment[]>;
}

interface ContextFragment {
  source: string;                         // 예: "intent@v2", "tasks/03-rca/rca.md"
  mode: "inline" | "path";                // 본문 삽입 또는 경로만 전달
  content: string;
  tokens: number;
}
```

v1 제공자:

| 제공자 | 우선순위 | 방식 |
|---|---|---|
| gate-policy (이 task의 승인 방식) | 100 | inline |
| intent (최신 버전) | 90 | inline |
| decisions | 80 | inline |
| next-options (이 노드에서 갈 수 있는 다음 노드) | 100 | inline |
| intent (최신 버전) | 90 | inline |
| gate-failure (게이트 실패로 돌아온 경우만) | 85 | inline (출력은 끝부분만) |
| decisions | 80 | inline |
| prev-handoff | 70 | inline |
| required-artifacts (`requires`) | 60 | path |

- 조립기는 우선순위 순으로 채우고, 토큰 예산을 넘으면 낮은 우선순위부터 `path` 모드로 강등한다. 우선순위 85 이상은 강등하지 않는다.
- **토큰 예산(inline 합계):** 잠정값 **8,000 토큰**. 스파이크 S6에서 실측한 뒤 확정한다.
- 결과는 `context.manifest.json`에 기록하고 UI에 "이번 세션에 주입된 것"으로 표시한다.
- 지식 주입은 이후 `knowledge` 제공자 하나를 추가해서 구현한다.

---

## 7. 승인 정책

skill 노드의 `approval`:

- `manual`: 사용자가 [Task 완료]를 눌러야 한다.
- `auto_if_checks`: 아래 조건을 **모두** 만족하면 카운트다운(기본 15초, 취소 가능) 뒤에 자동 승인한다.
  - handoff 스키마 검증 통과
  - `open_questions`가 비어 있음
  - `intent_deviation`이 null
  - `requires_human: true`이면서 `by: ai`인 결정이 없음
  - `checks`에 적힌 항목을 앱이 직접 다시 실행해서 모두 통과
  - diff 규모가 설정 한도 이내

안전장치:
- 연속 자동 승인 상한(기본 3회)을 넘으면 수동 승인으로 전환한다.
- 카운트다운(15초)과 연속 상한(3회)은 `config.json`의 설정값이다. 정해진 근거가 없는 초기값이므로, 쓰면서 불편하면 바꾼다. 조정 판단에 쓸 수 있도록 앱은 두 가지를 기록한다: 카운트다운 도중 취소한 횟수, 자동 승인된 task가 이후 되돌아가기 대상이 된 횟수.
- 의도 승인(`g-intent`)과 Work 완료(`g-done`)는 설정과 관계없이 항상 수동이다.
- 세션 도중 에이전트의 질문에는 절대 자동으로 답하지 않는다(비목표에 따라 task 내부는 관여하지 않음).

---

## 8. 벤더 연동 (v1: Claude Code)

| 필요 | 방법 |
|---|---|
| 실행 | node-pty로 `claude --session-id <uuid> --add-dir <work dir> "<첫 프롬프트>"` |
| 첫 프롬프트 | 스킬 호출 + 조립된 컨텍스트 + `RELAY_*` 경로 |
| 스킬 배포 | 세션 시작 전에 `<RELAY_HOME>/skills`를 worktree의 `.claude/skills/`로 복사(또는 링크) |
| 상태 신호 | worktree `.claude/settings.local.json`에 훅 주입: `Stop`(턴 종료), `Notification`(입력 대기), `SessionStart`(세션 ID 확인) |
| 훅 → 앱 통신 | 훅 명령은 **Node 스크립트**(`relay-hook.js`)로 작성해 로컬 IPC(named pipe / 유닉스 소켓)로 앱에 전달. bash에 의존하지 않음(Windows 호환) |
| 산출물 감지 | `<RELAY_HOME>/.../tasks/` 디렉터리 파일 감시 |
| 세션 재개 | 앱을 다시 켰을 때 미완료 task는 `claude --resume <uuid>`로 다시 연결 |

`.claude/settings.local.json`과 `.claude/skills/`의 relay 파일은 worktree의 `.git/info/exclude`에 추가해 커밋되지 않게 한다.

---

## 9. Windows 고려사항

- **PTY:** node-pty는 Windows 10 1809+의 ConPTY를 사용한다(VS Code 통합 터미널과 동일).
- **Claude Code:** Windows 네이티브 실행 시 Git for Windows가 필요하다. 앱 첫 실행 시 `claude`, `git` 설치 여부를 검사하고 안내한다.
- **경로:** 모든 경로는 Node `path` API로 다룬다. 훅 명령과 스크립트는 셸 의존성 없이 Node로 작성한다.
- **배포:** electron-builder로 NSIS 설치 파일을 만든다. 코드 서명이 없으면 SmartScreen 경고가 표시되므로, v1은 사용 안내 문서로 대응하고 서명은 이후 과제로 둔다.
- **WSL:** v1 지원 범위 밖이다(경로 변환과 프로세스 경계 문제).

---

## 10. v1 스킬 (버그 수정 파이프라인)

모든 스킬은 같은 골격을 따른다: 목적 / 필요 입력 / 사람에게 물을 결정 지점 / 완료조건 / 산출물 템플릿 / 공통 종료 절차.

| 스킬 | 사람에게 묻는 결정 | 산출물 | 완료조건 |
|---|---|---|---|
| `work-start` | 유형, 규모, 목표, 비목표, 완료조건, 제약 | `intent.md` | 필수 필드가 채워지고 완료조건이 검증 가능함 |
| `evidence` | 재현 조건 확인 | `evidence.md` | 재현 성공 여부와 재현 절차 명시 |
| `root-cause` | 가설 채택 | `rca.md` | 원인이 증거로 뒷받침되고, 기각된 가설이 기록됨 |
| `fix` | 계획에서 벗어날 때만 | 코드 커밋 | 재현 절차가 더 이상 실패하지 않고, 테스트 통과 |
| `final-verify` | 최종 승인 | `verification.md` | 완료조건마다 통과/실패와 증거. 테스트 파일 변경 여부 점검 |
| `deliver` | push/PR 실행 승인, PR 제목과 본문 검토 | `delivery.md` (브랜치, 커밋, PR 링크) | intent의 `delivery`대로 처리됨. `delivery: none`이면 노드를 건너뜀 |
| `intent-revise` | 변경 내용 승인 | `intent.md` 새 버전 + 변경 전후 차이 + 영향 받는 산출물 목록 | 영향 분석과 재개 노드 추천이 있음 (4.2) |
| (공통) `_close` | — | `handoff.md` | 스키마 준수 |

공통 종료 절차(`_close`): 산출물 확정 → handoff 작성(`status: awaiting_approval`) → 게이트 정책에 맞는 안내 문구 출력("산출물을 검토하고 Task 완료를 눌러 주세요" 또는 "검사 통과 시 자동으로 다음 단계로 진행합니다").

---

## 11. 스파이크 (설계 확정 전 검증)

| # | 확인할 것 | 성공 기준 |
|---|---|---|
| S1 | Windows에서 Electron + node-pty + xterm.js로 `claude` TUI 사용 | 입력, 붙여넣기, Esc/Ctrl+C, 창 크기 변경, 한글 입력이 네이티브 터미널과 동등 |
| S2 | worktree `settings.local.json`에 주입한 훅 → Node 스크립트 → 앱 IPC | `Stop`/`Notification` 신호를 1초 이내에 수신 |
| S3 | `--add-dir` + 권한 사전 허용으로 레포 밖 산출물 쓰기 | 승인 프롬프트 없이 `RELAY_TASK_DIR`에 파일 생성 |
| S4 | 첫 프롬프트 인자로 스킬 호출 + 컨텍스트 전달 | 스킬이 트리거되고 컨텍스트를 인지함 |
| S5 | (선택) Codex CLI 동일 항목 | Codex v1 포함 여부 결정 |
| S6 | 컨텍스트 토큰 예산 실측 | 아래 절차로 기본값 확정 |

**S6 절차 (토큰 예산)**

1. 실제 버그 2~3건으로 버그 수정 파이프라인을 수동으로 끝까지 진행한다. 앱 없이 스킬과 템플릿만으로 해도 된다.
2. task마다 제공자별 inline 크기를 기록한다(intent, decisions, prev-handoff 등).
3. 같은 task를 예산 4k / 8k / 16k로 시작해 비교한다. 비교 항목은 에이전트가 산출물을 다시 읽으려고 도구를 호출한 횟수, 이전 결정을 다시 묻는 빈도, 첫 응답의 방향 정확도다.
4. 품질 차이가 없는 가장 작은 값을 기본값으로 정한다.

S3가 실패하면 대안은 다음과 같다: worktree 내부의 `.relay/`(exclude 처리)에 쓰게 하고, 승인 시 앱이 중앙 저장소로 옮긴다.

---

## 12. 열린 질문

- `check` 게이트의 테스트 명령을 프로젝트별로 어떻게 등록할지(`project.json` 수동 입력 / 자동 탐지)
- `deliver`의 PR 생성 방식(`gh` CLI 필요 여부, 인증 확인)
- 토큰 예산 기본값: 스파이크 S6에서 확정

해결됨 (v0.1.1): worktree 위치 → D13, 브랜치 처리 → D15, 카운트다운과 연속 상한 → 설정값으로 두고 사용하며 조정(7절)

---

## 13. 로드맵

1. **M0:** 스파이크 S1~S4, S6 → 이 문서에 반영
2. **M1:** Project/Work 생성, worktree, PTY 터미널, 훅 신호, 상태 배지, Work 정리
3. **M2:** 버그 수정 파이프라인 전체(스킬 7종, handoff 검증, human/check 게이트, 승인 정책, 경로 변경 메뉴)
4. **M3:** 실제 사용 → 스킬 개선, 승인 정책 기본값 조정
5. **이후:** 지식 추출(`task.approved` 구독) + `knowledge` 제공자, `review` 게이트, 추가 파이프라인(기능 개발 등), Codex
