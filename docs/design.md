# relay-v2 설계 문서

- 상태: 초안 (v0.2)
- 범위: v1 (MVP)
- 이전 버전: v0.1.1 (변경 요약은 17절)

## 0. 문서 지도

| 문서 | 내용 |
|---|---|
| `docs/design.md` (이 문서) | 개요, 확정된 결정, 흐름, 수명주기, 장애와 복구, 승인 정책, 벤더 연동 |
| [`docs/ui.md`](ui.md) | 화면 설계 |
| [`docs/architecture.md`](architecture.md) | 앱 모듈 구조와 테스트 전략 |
| [`docs/contracts/`](contracts/README.md) | JSON Schema(handoff, intent, pipeline, work, event, project, config 등)와 [파이프라인 상태 기계](contracts/state-machine.md) |
| [`docs/skills/`](skills/README.md) | 버그 수정 파이프라인 스킬 6종과 공통 종료 절차 명세 |
| [`docs/spikes.md`](spikes.md) | 스파이크 S1~S6 실행 계획 |

표기: 근거가 약한 초기값은 **(기본값)**으로 표시한다. 쓰면서 조정한다.

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
- **task 내부 게이트를 두지 않는다.** 세션 도중의 통제는 CLI의 자체 권한 체계에 맡긴다. (Stop 훅의 형식 오류 되돌림(D21)은 진행 여부를 판단하지 않으므로 게이트가 아니다.)
- 실행 중인 세션에 텍스트를 주입하지 않는다(PTY 쓰기 자동화 없음). 개입은 세션 시작 시점(시작 인자, 재개 인자)에만 한다.
- 한 Work 안의 task는 순차 실행한다. 여러 Work는 동시에 진행할 수 있다(D20).
- 세션 전환을 숨기지 않는다. task 경계는 화면에 명시적으로 보인다(ui.md 2.4).
- v1은 기본 브랜치 변화 추적(자동 rebase/merge)을 하지 않는다.

---

## 2. 확정된 결정

상태: `유지` = v0.1.1 그대로, `개정` = v0.2에서 내용 변경, `신규` = v0.2에서 추가. `사용자 결정`은 이번 세션에서 사용자에게 물어 정한 것.

| # | 결정 | 이유 | 상태 |
|---|---|---|---|
| D1 | CLI를 PTY로 실행하고 xterm.js로 앱에 임베드 | CLI 사용성을 그대로 얻고, 벤더 업데이트를 따라갈 필요가 없음 | 유지 |
| D2 | 구조화된 정보는 옆 채널(훅, 산출물 파일, git)로 받음. 터미널 화면은 파싱하지 않음 | 화면 출력은 ANSI 렌더링일 뿐이라 신뢰할 수 없음 | 유지 |
| D3 | 스킬이 산출물과 handoff를 먼저 작성하고 승인을 요청. **승인 상태는 앱이 `work.json`에 기록**하고, handoff의 `status`는 에이전트용 두 값(`awaiting_approval`, `blocked`)만 둔다 | 사람이 대화가 아니라 산출물을 승인함. 에이전트가 쓰는 파일에 앱 상태를 섞으면 에이전트가 `approved`를 쓸 수 있고, 앱과 에이전트가 같은 파일을 동시에 쓰는 경쟁이 생김 | 개정 |
| D4 | 게이트는 앱이 소유. 스킬은 일과 산출물만 담당 | 게이트를 추가/변경할 때 스킬을 수정하지 않기 위함 | 유지 |
| D5 | 다음 task는 파이프라인 상태 기계가 결정. `recommended_next`는 허용된 전이 안에서만 반영 | 앱이 또 하나의 LLM이 되지 않도록 | 유지 |
| D6 | 의도(intent)는 버전을 관리하며 모든 task에 주입 | 방향 유지, 의도 변경 추적 | 유지 |
| D7 | 자동 승인은 외부에서 결정론적으로 확인되는 조건으로만 판단. 의도 승인과 Work 완료는 항상 수동 | 조기 종료(premature completion) 방지 | 유지 |
| D8 | 데스크톱 프레임워크: Electron | node-pty + xterm.js 조합이 가장 검증됨. Windows ConPTY 지원 | 유지 |
| D9 | v1 벤더: Claude Code만. Codex는 S5 결과에 따라 결정 | 연동 깊이 확보를 우선 | 유지 |
| D10 | 산출물 저장소는 레포 밖의 중앙 저장소. 프로젝트/워크별 디렉터리로 구분 | worktree 삭제 시 함께 사라지지 않게, 레포에 잡음을 남기지 않게 | 유지 |
| D11 | 첫 파이프라인: 버그 수정 | 짧고 완료조건이 명확해서 구조의 효과를 가장 빨리 검증 | 유지 |
| D12 | 1차 지원 플랫폼: Windows 네이티브 (macOS/Linux도 동작하도록 작성) | 주 사용 환경 | 유지 |
| D13 | worktree 기본 위치는 중앙 저장소 아래 | 산출물과 작업 공간을 한곳에서 관리 | 유지 |
| D14 | 스킬은 파이프라인을 모른다. 이 노드에서 허용되는 다음 노드 목록은 앱이 주입한다 | 파이프라인을 바꿀 때 스킬을 수정하지 않기 위함 | 유지 |
| D15 | 전달(push/PR) 여부는 intent의 `delivery`로 정한다. `work-start`가 묻되, `project.json`에 기본값이 있으면 묻지 않는다 | 외부로 나가는 동작은 사람이 의도한 경우에만. 매번 같은 질문을 하지 않도록(질문 피로) | 개정 |
| D16 | 완료/포기한 Work는 [Work 정리]로 worktree를 제거한다. 산출물은 보존한다 | 디스크와 브랜치 목록 정리. 기록은 남김 | 유지 |
| D17 | 승인하면 앱이 그 task의 CLI 프로세스를 종료한다 (`sessions.kill_on_approval`, 기본 true) | "읽기 전용"의 실체. 승인 후 에이전트가 산출물이나 코드를 계속 바꾸는 것을 막음 | 신규 |
| D18 | 조립한 컨텍스트는 task 디렉터리의 `context.md` 파일로 쓰고, 첫 프롬프트는 스킬 호출 + 그 파일 경로만 담는다 | Windows 명령줄 길이 한도(32,767자)와 인용 문제. 8천 토큰 컨텍스트는 인자로 넘기기에 위험함. 사람도 같은 파일을 볼 수 있음 | 신규 |
| D19 | **push/PR은 앱이 `g-done`에서 결정론적으로 수행한다. `deliver` 스킬은 없앤다.** PR 제목/본문 초안은 `final-verify`가 쓴다. `gh`가 없거나 인증이 안 되어 있으면 intake 승인 때 경고하고 push + 비교 URL로 대체 | 세션과 승인이 하나 줄고, 외부로 나가는 동작이 결정론적이 됨. 에이전트에게 push 권한이 필요 없음 | 신규 · 사용자 결정 |
| D20 | 여러 Work를 동시에 진행할 수 있다. 살아 있는 CLI 세션 상한 3(기본값, 설정 가능), 같은 프로젝트의 check 명령은 직렬 실행. 백그라운드 Work의 대기 상태는 배지와 OS 알림으로 알림 | 검사가 도는 동안 다른 일을 할 수 있어야 함. 포트/DB 충돌 방지 | 신규 · 사용자 결정 |
| D21 | 이번 턴에 handoff가 작성/수정됐는데 스키마 검증에 실패하면, Stop 훅으로 오류 목록을 에이전트에게 되돌린다(연속 2회까지). 진행 여부나 내용 품질은 판단하지 않는다 | "검증이 계속 실패" 장애의 대부분을 사람 개입 없이 해소. 형식만 다루므로 task 내부 게이트가 아님 | 신규 · 사용자 결정 |
| D22 | Work 생성 시 파이프라인 템플릿을 `works/<id>/pipeline.yaml`로 스냅숏한다 | 템플릿을 고쳐도 진행 중인 Work가 깨지지 않게 | 신규 |
| D23 | **재현 테스트 고정(repro lock)**: evidence가 실패하는 재현 테스트를 커밋하면 앱이 `test_file` 명령으로 실패를 확인하고 파일 해시를 고정한다. 이후 fix/g-tests는 그 테스트가 통과해야 하고, 파일이 바뀌면 자동 승인하지 않는다 | D7을 실제로 작동시키는 장치. "테스트를 고쳐서 통과"를 결정론적으로 잡음. `test_file` 명령이 없거나 자동 재현이 안 되는 버그는 수동 승인으로 자연 강등 | 신규 · 사용자 결정 |
| D24 | relay 스킬은 worktree의 `.claude/skills/relay-<name>/`으로 배포한다 | 프로젝트 자체 스킬과 이름 충돌 방지 | 신규 |
| D25 | 훅 스크립트와 검증 스크립트는 relay 실행 파일을 Node로 실행한다(`ELECTRON_RUN_AS_NODE=1`) | Claude Code 네이티브 설치 환경에는 Node가 없을 수 있음. S2에서 확인 | 신규 |
| D26 | 자동 승인에서 앱이 실행하는 검사는 **파이프라인 노드의 `auto_checks`**가 정한다. handoff의 검사 결과(`self_checks`)는 표시용이다. `auto_checks`가 비어 있으면 자동 승인하지 않는다 | v0.1은 "handoff `checks`에 적힌 항목을 재실행"이라 에이전트가 `checks: {}`를 쓰면 조건이 공허하게 충족되는 구멍이 있었음 | 신규 |
| D27 | `fast_path`를 없애고 노드별 `when`(intent 필드 비교식)으로 통일한다. `requires`에 선택 입력(`?`)을 둔다 | S 경로에서 verify가 evidence/rca를 요구해 항상 경고가 뜨는 모순 해소. 의도 개정으로 size가 바뀌면 경로도 자연히 바뀜 | 신규 |
| D28 | 파이프라인은 Work 생성 시 사용자가 고른다(v1은 버그 수정 하나). `work-start`는 적합성만 판단해 `pipeline_fit`으로 알린다 | v0.1은 intent.type으로 파이프라인을 고르는데 intent는 파이프라인의 첫 노드가 만든다(순환). 유형 오분류는 사람 선택 + 경고로 다룸 | 신규 |
| D29 | 기본 경로가 아닌 `recommended_next`가 있으면 자동 승인하지 않는다 | 경로 변경은 판단이므로 사람이 한 번 봐야 함 | 신규 |
| D30 | 자동 승인은 handoff의 마지막 수정 **이후에** Stop 신호가 도착했을 때만 시작한다 | 에이전트가 handoff를 쓴 뒤에도 턴이 이어지는 경우 방지. 훅이 유실되면 수동 승인으로 떨어질 뿐 진행은 막히지 않음 | 신규 |
| D31 | evidence는 `auto_if_checks`(`repro:fails`)를 유지한다. 재현 테스트가 올바른 이유로 실패하는지는 rca 수동 승인 화면에서 사람이 함께 확인한다 | "실패한다"는 결정론적으로 확인되지만 "옳게 실패한다"는 아님. 승인 횟수를 늘리지 않고 사람의 눈을 한 번 거치게 함 | 신규 |
| D32 | 앱은 단일 인스턴스로 실행한다 | 두 인스턴스가 같은 `RELAY_HOME`을 쓰면 상태가 깨짐 | 신규 |
| D33 | check 명령은 프로젝트 등록 시 **자동 탐지 후 사용자 확인**으로 등록한다. `setup`(worktree 준비 명령)과 `test_file`(파일 단위 실행)도 함께 등록한다 | v0.1 열린 질문 1 해소. 새 worktree에는 의존성이 없으므로 setup이 필요함 | 신규 |
| D34 | `decisions.md`는 앱이 task 승인 시 handoff의 `decisions`를 추가해서 만든다 | v0.1에 작성 주체가 없었음. 에이전트는 앱 소유 파일을 쓰지 않음 | 신규 |
| D35 | 인수인계 정보 손실 대책: `rejected`를 모든 이후 task에 누적 주입(`rejected-log`), 이전 모든 handoff 요약(`handoff-chain`), 이전 세션 기록 경로(`transcripts`)를 제공한다 | 직전 handoff만 주입하면 두 단계 전의 기각 가설과 결정이 사라짐 | 신규 |
| D36 | check 결과는 `(검사, HEAD 커밋, worktree 깨끗함)`이 같으면 재사용한다 | fix의 auto_checks와 바로 뒤 g-tests가 같은 테스트를 두 번 도는 낭비 제거 | 신규 |
| D37 | 사람이 승인한 skill task 바로 다음이 human 게이트면 한 번 클릭으로 둘 다 통과한다(intake → [의도 승인], verify → [Work 완료]) | 같은 내용을 두 번 승인하는 절차 과잉 제거. 기록은 둘 다 남고, 자동 승인에는 적용하지 않으므로 D7 유지 | 신규 |

---

## 3. v0.1.1 비판적 검토 결과

### 3.1 발견한 모순과 빈틈

| # | 문제 | 조치 |
|---|---|---|
| 1 | 자동 승인 조건 "`checks`에 적힌 항목을 재실행해 모두 통과"는 에이전트가 항목을 적지 않으면 공허하게 참 | D26 |
| 2 | handoff `status`에 앱 소유 상태(`approved`, `abandoned`)가 섞여 있고, 승인 뒤에도 세션이 살아 있어 산출물이 바뀔 수 있음 | D3 개정, D17, 승인 시점 산출물 해시(state-machine.md 7절) |
| 3 | 자동 승인 시작 시점이 불명확(handoff를 쓴 직후 에이전트가 아직 작업 중일 수 있음) | D30 |
| 4 | evidence가 `auto_if_checks`인데 결정론적으로 확인할 조건이 없음 | D23, D31 |
| 5 | `fast_path` S 경로에서 verify의 `requires`(evidence, rca)가 항상 미충족 | D27 |
| 6 | intent.type으로 파이프라인을 고른다는 설계가 순환(intent는 파이프라인 첫 노드가 만듦) | D28 |
| 7 | 첫 프롬프트 인자로 8천 토큰을 넘기는 방식은 Windows 명령줄 한도와 인용 문제에 걸림 | D18 |
| 8 | `deliver` 스킬이 에이전트에게 외부 동작(push/PR)을 맡김. 세션 하나, 승인 하나가 늘어남 | D19 |
| 9 | 훅 스크립트가 Node를 전제하지만 사용자 PC에 Node가 없을 수 있음 | D25 |
| 10 | 파이프라인 템플릿을 고치면 진행 중 Work의 노드 참조가 깨질 수 있음 | D22 |
| 11 | `decisions.md` 작성 주체가 없음 | D34 |
| 12 | `requires`의 `evidence/evidence.md`(노드 id)와 저장 경로 `tasks/02-evidence/`(순번-스킬)의 대응 규칙이 없음. `verification.md` 위치도 두 곳에 적혀 있음 | 디렉터리를 `<순번>-<노드 id>`로, `<node>/<file>`은 그 노드의 최근 승인 step으로 해석(state-machine.md 3.3). verification.md는 task 디렉터리에만 |
| 13 | `task.rejected` 이벤트는 앱이 감지할 방법이 없음(반려는 같은 세션 대화로 처리) | 이벤트 제거 |
| 14 | handoff `status: needs_rework`의 의미와 처리가 정의되지 않음 | 제거 |
| 15 | handoff의 `git` 필드: 앱이 직접 알 수 있는 사실을 에이전트에게 쓰게 함 | 제거. 앱이 work.json에 기록 |
| 16 | 새 worktree에는 의존성이 설치되어 있지 않아 첫 check가 실패함 | `project.setup` (D33) |
| 17 | fix의 자동 승인 검사와 g-tests가 같은 테스트를 두 번 실행 | D36 |
| 18 | 앱을 두 번 실행하면 상태 파일이 깨짐 | D32 |
| 19 | 비기본 추천이 자동 승인과 함께 진행되면 사람이 경로 변경을 못 봄 | D29 |
| 20 | intake 승인 뒤 g-intent 승인, verify 승인 뒤 g-done 승인이 같은 내용의 이중 클릭 | D37 |

### 3.2 과한 설계로 판단해 줄이거나 미룬 것

- `deliver` 스킬 제거(D19), `fast_path` 제거(D27), handoff의 `git`/`checks` 제거.
- `review` 게이트는 v0.1대로 인터페이스만 정의하고 v1에서는 실행하지 않는다.
- `knowledge_candidates`는 저장만 한다(추출과 주입은 이후).
- `when` 식 문법은 비교(`==`, `!=`, `in`)와 `and`만 둔다.
- 반대로 늘린 것: 컨텍스트 제공자(7개 → 16개). 각각 정보 손실 대책이나 특정 스킬의 입력으로 필요하다(6.5절).

### 3.3 앞 논의의 위험이 어떻게 반영됐나

| 위험 | 대책 | 남은 위험 |
|---|---|---|
| **작은 work의 절차 과잉** | S 크기는 evidence/rca 생략(`when`). 연속 수동 승인 합치기(D37). S 경로 사람 클릭 2회(의도 승인, Work 완료), M 경로 3회. fix는 조건 충족 시 자동 승인 | "한 줄 수정"에도 intake와 verify 세션이 열림. M3에서 불편하면 intake+fix 한 세션인 `quickfix` 파이프라인을 추가(설정만으로 가능한지 검증 과제) |
| **질문 피로** | 스킬마다 질문 예산과 결정 지점 고정, 한 번에 묶어서 추천안과 함께 질문, "추천대로"로 답 가능(skills/README.md 3.2). delivery는 프로젝트 기본값(D15). evidence/fix는 보통 질문 0개 | 결정 지점 목록이 실제로 적절한지는 M3에서 확인 |
| **파이프라인 경직성** | `transitions`, 언제든 [다음 단계 변경] (기타 스킬을 임시 노드로), 의도 개정, `when`으로 경로가 intent를 따름. 모든 우회는 `task.rerouted`로 기록해 템플릿 개선 근거로 씀 | 임시 노드의 산출물은 파이프라인 노드의 `requires`에 연결되지 않음(경로만 전달) |
| **유형 오분류** | 파이프라인은 사람이 고름(D28), `pipeline_fit` 경고. 규모 오분류는 fix → rca/evidence 전이로 탈출, 애매하면 M 추천 | v1 파이프라인이 하나라 misfit이면 포기 후 수동 작업 외 선택지 없음 |
| **task 사이 정보 손실** | handoff 필수 `rejected`, 누적 `rejected-log`, `handoff-chain`, `transcripts` 경로, 결정 로그, "다음 task가 알아야 할 것" 작성 규칙, stale 표시, 주입 내역을 UI에 표시, S6에서 예산 실측 | 요약 과정의 손실 자체는 없앨 수 없음. transcript 검색은 에이전트의 판단에 맡김 |

추가로 확인한 위험:
- 재현 테스트가 "잘못된 이유로" 실패하는 경우 → D31(rca에서 사람 확인), final-verify의 테스트 약화 점검.
- 불안정한(flaky) 테스트 → 자동 재시도 없음(v0.1 유지). 연속 실패 상한에서 사람을 부른다.
- Claude Code의 플래그/훅 형식 변경 → `VendorAdapter`에 격리하고 릴리스 전 스모크(architecture.md 5절).

---

## 4. 개념 모델

```
Project (레포 1개, project.json)
 └─ Work (하나의 목적, git worktree 1개, 파이프라인 스냅숏 1개)
     ├─ Intent (버전 관리, 모든 task에 주입)
     ├─ Decision log (승인 시 앱이 추가)
     ├─ Repro lock (0~1개)
     └─ Step (파이프라인 노드 1회 실행)
         ├─ skill step = Task (CLI 세션 1개): Artifacts + Handoff + context.md
         └─ gate step (human / check / review): 검사 결과, 로그
```

| 용어 | 정의 |
|---|---|
| Project | 등록된 git 레포 하나 |
| Work | 사용자가 달성하려는 하나의 목적. 파이프라인 인스턴스 하나와 git worktree 하나를 가짐 |
| Step | 파이프라인 노드를 한 번 실행한 것. skill step과 gate step이 같은 순번 체계를 쓴다 |
| Task | skill step. CLI 세션 하나에 대응. 승인/포기되면 세션이 종료되고 터미널은 읽기 전용이 됨 |
| Pipeline | 작업 유형별 노드(스킬/게이트) 순서와 전이를 정의한 템플릿 |
| Gate | 노드 사이의 통과 조건. `human`, `check`, `review` |
| Artifact | task가 만든 결과물 파일. 원본으로 영속되며 이후 task가 경로로 참조 |
| Handoff | task의 요약과 다음 task에 넘길 정보. 에이전트가 쓰고 앱이 스키마로 검증 |
| Repro lock | 앱이 실패를 확인하고 해시를 고정한 재현 테스트 파일 (D23) |

---

## 5. 핵심 흐름

```
[사용자] 프로젝트 선택 → [새 Work]: 파이프라인 선택, 요청 입력
   ↓
[앱] worktree 생성 → project.setup 실행 → 저장소 디렉터리 → 파이프라인 스냅숏 → work.created
   ↓
┌─▶ [앱] 다음 노드 결정 (상태 기계: contracts/state-machine.md)
│     ├─ skill 노드:
│     │    1) 스킬 배포, task 전용 설정(훅, 권한) 생성
│     │    2) 컨텍스트 조립 → context.md + manifest
│     │    3) PTY로 `claude` 실행 (첫 프롬프트 = /relay-<skill> + context.md 경로)
│     │    4) 사용자가 터미널에서 에이전트와 작업
│     │    5) 스킬이 산출물 + handoff(status: awaiting_approval) 작성 → 검증 명령 실행
│     │    6) 턴 종료(Stop 훅) → 앱이 검증. 형식 오류면 Stop 훅으로 되돌림(D21)
│     │    7) 유효하면 승인 대기. 자동 승인 조건 평가(9절) → 카운트다운 또는 수동
│     │    8) 승인 → work.json 기록, 세션 종료(D17), decisions.md 추가, task.approved
│     └─ gate 노드: check는 앱이 실행·판정 / human은 버튼 (직전 수동 승인과 합칠 수 있음, D37)
└─── 반복
   ↓
[사용자] verify 승인 = [Work 완료] → [앱] delivery 수행(push/PR, D19) → work.completed
   ↓
[사용자] [Work 정리] → worktree 제거 → work.cleaned
```

### 5.1 반려, 되돌아가기, 경로 변경

승인 전 수정 요청은 같은 세션에서 대화로 처리한다(에이전트가 산출물과 handoff를 고침). 다음 노드가 바뀌는 경우는 네 가지이며, 규칙은 [state-machine.md](contracts/state-machine.md) 5절에 있다.

| 경우 | 동작 |
|---|---|
| 게이트 실패 | `on_fail` 노드로 새 task. 실패 정보는 `gate-failure` 제공자가 주입. 같은 게이트 연속 실패 상한(기본값 3)에서 사람을 부름 |
| handoff 추천 | `recommended_next`가 허용 목록 안이면 승인 버튼이 그 노드를 가리킴(자동 승인은 안 됨, D29). 목록 밖이면 [다음 단계 변경] 메뉴 |
| blocked | 승인 대신 `blocked_reason`과 다음 단계 선택지를 보여 줌 |
| 사용자 선택 | 언제든 [다음 단계 변경]: 기본 / 허용된 전이 / 기타 스킬(임시 노드). 실행 중 task는 `abandoned`, 산출물 보존. `requires` 미충족은 경고만 |

모든 경로 변경은 `task.rerouted`로 기록한다(자주 쓰는 우회 → 정식 전이로 승격하는 근거).

### 5.2 의도 개정 (`intent-revise`)

- 계기: handoff의 `intent_deviation`(자동 승인 금지, 승인 화면에서 [의도 수정] 강조) 또는 사용자의 [의도 수정].
- 앱이 `x-intent-revise` 임시 노드로 task를 연다. 스킬은 새 intent 초안, 변경 전후 차이, 무효가 되는 승인된 산출물, 재개 노드 추천을 만든다([skills/intent-revise.md](skills/intent-revise.md)). 승인은 항상 수동.
- 승인되면 앱이 intent 버전을 올리고(이전 버전은 `intent.history/`), 산출물에 stale 표시를 하고, 재개 노드에서 이어 간다. stale이 남아 있는 동안 자동 승인은 멈춘다.

---

## 6. 실행 세부

### 6.1 중앙 저장소

위치: `<RELAY_HOME>` (기본값 `%USERPROFILE%\.relay`, macOS/Linux는 `~/.relay`. 환경 변수 `RELAY_HOME`으로 변경 가능)

```
<RELAY_HOME>/
  config.json                         # 앱 설정 (7.5절)
  bin/                                # relay-hook.js, relay-validate.js (앱이 배포)
  run/                                # 실행 중 상태: IPC 소켓(유닉스), 잠금 파일
  pipelines/bugfix.yaml               # 파이프라인 템플릿
  skills/<name>/                      # SKILL.md, relay.json, templates/
  projects/
    <project-id>/                     # 예: my-api-3f9a2c
      project.json                    # 7.1절, contracts/project.v1.schema.json
      knowledge/                      # (향후)
      worktrees/<work-id>/            # git worktree
      works/
        <work-id>/                    # 예: w-20260925-001
          work.json                   # 상태의 단일 원천 (contracts/work.v1.schema.json)
          pipeline.yaml               # 생성 시 스냅숏 (D22)
          intent.md                   # 승인된 최신 의도
          intent.history/v1.md …
          decisions.md                # 승인 시 앱이 추가 (D34)
          events.jsonl                # 수명주기 이벤트 (contracts/event.v1.schema.json)
          tasks/
            01-intake/                # <순번>-<노드 id>
              context.md              # 주입된 컨텍스트 (D18)
              context.manifest.json
              session.settings.json   # task 전용 훅/권한 설정
              pty.log                 # 읽기 전용 재생용 터미널 출력
              intent.draft.md
              handoff.md
            02-g-intent/              # human 게이트는 디렉터리를 만들지 않아도 됨(기록은 work.json)
            03-evidence/  evidence.md  handoff.md  checks/repro-fails.log …
            06-g-tests/   checks/cmd-test.log …
```

### 6.2 worktree

- 위치: `<RELAY_HOME>/projects/<project-id>/worktrees/<work-id>/` (D13)
- 브랜치: `relay/<work-id>`, 기준은 `project.json`의 `default_branch`의 **로컬 최신 커밋**(생성 시 `git fetch`는 하지 않음, 기본값).
- 생성 직후 `project.setup`을 실행한다. 실패하면 worktree를 지우고 Work를 만들지 않는다.
- Windows 경로 길이: 앱이 해당 레포에 `core.longpaths=true`를 설정한다.
- `.git/info/exclude`(worktree 공통)에 `.claude/skills/relay-*/`, `.claude/settings.local.json`을 추가한다.

### 6.3 결정 로그 (`decisions.md`)

앱이 task 승인 시 추가한다. 에이전트는 읽기만 한다.

```markdown
## t-04 rca — 2026-09-25 10:42 (사람 승인)
- [사람] 원인은 토큰 만료 시각 비교의 타임존 불일치 — 재현 테스트 실패 값의 차이가 정확히 9시간
- [AI] 수정 방향은 epoch 비교 — 라이브러리 추가 없이 가능
```

### 6.4 task 시작 절차

1. **세션 슬롯 확인:** 살아 있는 세션이 `sessions.max_live` 이상이면 Work를 `paused(session_limit)`로 두고 대기열에 넣는다. 슬롯이 나면 먼저 들어온 순서로 자동 시작하고 알린다(기본값).
2. **스킬 배포:** `<RELAY_HOME>/skills/<skill>/` → `<worktree>/.claude/skills/relay-<skill>/` (+ `relay-close`).
3. **task 설정 파일:** `tasks/<nn>/session.settings.json`에 훅(`SessionStart`, `Stop`, `Notification`, `SessionEnd`) 명령과 work 디렉터리 쓰기 허용 규칙을 쓴다. 적용 방식은 S2 결과에 따라 `claude --settings <파일>`(우선) 또는 worktree의 `.claude/settings.local.json`.
4. **컨텍스트 조립:** 제공자 실행 → `context.md`, `context.manifest.json` (6.5절).
5. **실행:**
   ```
   claude --session-id <uuid> --add-dir <work 디렉터리> [--settings <task 설정>] [config.tools.claude_extra_args…]
          "/relay-<skill> 이 task의 컨텍스트: <context.md 절대 경로>"
   ```
   cwd = worktree. 환경 변수: `RELAY_HOME`, `RELAY_WORK_ID`, `RELAY_STEP_ID`, `RELAY_WORK_DIR`, `RELAY_TASK_DIR`, `RELAY_IPC`, `RELAY_IPC_TOKEN` + `project.env`.
6. **확인:** 10초 안에 `SessionStart` 신호가 오지 않으면 "훅 신호가 없습니다(자동 승인 불가)" 경고를 머리 띠에 표시한다. 진행은 계속한다.

### 6.5 컨텍스트 제공자

인터페이스는 v0.1과 같다(architecture.md 3절). 조립기는 우선순위 순으로 inline을 채우고, 토큰 예산을 넘으면 낮은 우선순위부터 path로 강등한다. **우선순위 85 이상은 강등하지 않는다.** 결과는 `context.md`와 manifest에 기록되고 UI [컨텍스트] 탭에 보인다.

| 제공자 | 우선순위 | 방식 | 언제 |
|---|---|---|---|
| gate-policy | 100 | inline | 항상 |
| next-options | 100 | inline | 항상 (임시 노드는 "원래 위치로 복귀"만) |
| intent (최신 버전) | 90 | inline | intent 승인 후 |
| revise-trigger | 88 | inline (계기, 승인된 산출물 목록, 노드 목록) | intent-revise |
| initial-request | 86 | inline(work-start) / path(그 외) | 항상 |
| gate-failure | 85 | inline (로그 끝 `log_tail_lines`줄) | 게이트 실패로 돌아온 경우 |
| repro-lock | 82 | inline (파일, 고정 커밋, 실패 출력 끝부분) | 고정이 있을 때 |
| project-profile | 80 | inline | work-start, evidence |
| decisions | 80 | inline | 항상 |
| rejected-log | 75 | inline (모든 승인된 handoff의 `rejected` 누적, D35) | 항상 |
| prev-handoff | 70 | inline | 직전 skill step이 있을 때 |
| git-diff | 65 | inline (파일 목록, 줄 수, 테스트 파일 변경) | fix 재진입, final-verify |
| check-results | 65 | inline | final-verify |
| required-artifacts (`requires`) | 60 | path (stale/missing 표시) | 노드에 requires가 있을 때 |
| handoff-chain | 50 | inline (직전 제외 모든 handoff의 "요약" 절) | 항상 |
| transcripts | 10 | path (이전 task 세션 기록 파일) | 항상 |

- **토큰 예산(inline 합계):** 잠정 8,000 토큰(기본값). S6에서 확정.
- 토큰은 `chars_per_token`(기본값 2.5)으로 추정한다. 정확한 토크나이저는 쓰지 않는다.
- 지식 주입은 이후 `knowledge` 제공자 하나를 추가해서 구현한다.

---

## 7. 프로젝트와 Work 수명주기

### 7.1 프로젝트 등록

1. **폴더 선택** → `git rev-parse --show-toplevel`로 레포 루트 확인. bare 레포, relay worktree 안의 폴더는 거부. 이미 등록된 레포면 기존 프로젝트를 연다.
2. **기본 정보 탐지:** `project_id`(폴더 이름 + 경로 해시), `default_branch`(`origin/HEAD` → `main` → `master`), `remote`(`origin` 유무), `gh` 설치와 `gh auth status`.
3. **check 명령 자동 탐지 (D33):** 아래 규칙으로 후보를 만든다. 여러 개 걸리면 모두 보여 주고 사용자가 고른다.

   | 단서 | test | test_file | setup |
   |---|---|---|---|
   | `package.json` + vitest | `<pm> test` | `npx vitest run {file}` | `<pm> ci`/`install --frozen-lockfile` (lockfile로 pm 판별) |
   | `package.json` + jest | `<pm> test` | `npx jest {file}` | 같음 |
   | `pyproject.toml`/`pytest.ini` | `python -m pytest -q` | `python -m pytest -q {file}` | 없음(가상환경 안내) |
   | `go.mod` | `go test ./...` | 없음(패키지 단위라 고정 미지원) | `go mod download` |
   | `Cargo.toml` | `cargo test` | 없음 | 없음 |
   | `*.sln`/`*.csproj` | `dotnet test` | 없음 | `dotnet restore` |
   | `gradlew` / `pom.xml` | `./gradlew test` / `mvn -q test` | 없음 | 없음 |

   `test_file`이 없으면 repro lock을 쓰지 않는다는 안내를 보여 준다. 사용자가 직접 입력할 수 있다.
4. **확인과 수정:** 탐지 결과 표를 편집 가능한 폼으로 보여 준다. `test`는 필수.
5. **시험 실행(선택, 권장):** 임시 worktree를 만들어 `setup` → `test`를 실행하고 결과를 보여 준 뒤 임시 worktree를 지운다. 메인 체크아웃을 건드리지 않기 위함이다.
6. **delivery 기본값:** `ask`(기본값) / `none` / `push` / `pr`. 원격이 없으면 `none` 고정.
7. **저장:** `project.json`, `core.longpaths=true`.

등록 후 [프로젝트 설정]에서 고칠 수 있다. 명령은 실행 시점에 읽으므로 즉시 반영된다. 단, 진행 중 Work의 파이프라인이 참조하는 `cmd:<key>`를 지우면 저장을 거부한다(P8).

### 7.2 Work 생성

[새 Work] → 프로젝트, 파이프라인(D28), 요청(여러 줄) 입력 → worktree 생성 → setup → 스냅숏 → `work.created` → intake task 시작. Work id는 `w-<YYYYMMDD>-<일련번호 3자리>`(프로젝트 안에서 유일).

### 7.3 중단, 포기, 재개, 경로 변경, 동시 Work

| 동작 | 가능한 상태 | 결과 |
|---|---|---|
| [일시 정지] | active, needs_attention | 실행 중 세션 종료(step `interrupted`), Work `paused`. worktree와 산출물 그대로 |
| [재개] | paused | 중단된 step이 있으면 `claude --resume <session-id>`로 이어 가기(기본) 또는 [새 세션으로 이 노드 다시]. 없으면 다음 노드 진입 |
| [Work 포기] | completed/archived 외 모두 | 실행 중 step `abandoned`, 세션 종료, `work.abandoned`. worktree는 남음 → [Work 정리] 또는 [포기 취소] |
| [다음 단계 변경] | active, needs_attention, paused | 5.1절 |
| [의도 수정] | active, needs_attention, paused | 5.2절 |

**동시 Work (D20)**
- 서로 다른 Work는 서로 다른 worktree와 브랜치를 쓰므로 파일 충돌은 없다.
- 살아 있는 세션 합계가 상한을 넘으면 새 task는 대기열에 들어간다(6.4절 1).
- 같은 프로젝트의 check 명령은 프로젝트 단위 큐로 하나씩 실행한다(`checks.serialize_per_project`).
- 선택되지 않은 Work의 승인 대기, 입력 대기, 검사 실패, needs_attention은 사이드바 배지와 OS 알림으로 알린다. 자동 승인 카운트다운은 백그라운드 Work에서도 진행한다.
- 같은 버그를 다루는 Work가 둘 생기는 것은 막지 않는다.

### 7.4 Work 완료와 정리

**Work 완료** (`g-done`, 항상 수동. 보통 verify 승인과 합쳐서 한 번 클릭, D37)
- 사전 조건: intent.delivery가 `none`이 아니면 worktree가 깨끗해야 한다(아니면 버튼 비활성, 이유 표시).
- 앱이 `delivery`를 수행한다(D19): `push`는 `git push -u <remote> relay/<work-id>`, `pr`은 push 후 `gh pr create`(제목/본문은 final-verify의 `delivery_draft`, `project.delivery.pr_draft`면 draft). 같은 브랜치의 PR이 이미 있으면 새로 만들지 않고 링크만 기록한다.
- `gh`가 없거나 인증이 안 되어 있으면: intake 승인 화면에서 미리 경고하고, 완료 시에는 push 후 비교 URL을 보여 준다.
- 실패하면 Work는 `needs_attention(delivery_failed)`: [다시 시도] [delivery 없이 완료].

**Work 정리** (completed, abandoned에서 활성화)

앱은 먼저 확인하고 요약을 보여 준다.

| 확인 항목 | 문제가 있을 때 |
|---|---|
| worktree에 커밋하지 않은 변경 | 경고, 사용자가 명시적으로 확인해야 진행 |
| 브랜치의 커밋이 원격이나 기본 브랜치에 없음 | "브랜치는 유지, worktree만 제거"를 기본값으로 선택 |
| 실행 중 세션 | 있으면 정리 불가 (먼저 종료) |

정리 동작: `git worktree remove`(실패 시 `--force`는 사용자 확인 후), 브랜치 삭제는 선택(기본 유지, 병합·push된 경우에만 삭제 제안), 산출물은 삭제하지 않음, Work 상태 `archived`, `work.cleaned`.

### 7.5 앱 설정 (`config.json`)

스키마와 설명: [contracts/config.v1.schema.json](contracts/config.v1.schema.json). 모두 기본값이다.

| 키 | 기본값 | 뜻 |
|---|---|---|
| `tools.claude_path` / `git_path` / `gh_path` | null (PATH 탐색) | 도구 경로 |
| `tools.claude_extra_args` | `[]` | 모든 세션에 추가할 인자 |
| `sessions.max_live` | 3 | 살아 있는 CLI 세션 상한 (D20) |
| `sessions.kill_on_approval` | true | 승인 시 세션 종료 (D17) |
| `approval.countdown_sec` | 15 | 자동 승인 카운트다운 |
| `approval.pause_on_input_sec` | 10 | 터미널 입력 시 카운트다운 정지 시간 |
| `approval.max_consecutive_auto` | 3 | 연속 자동 승인 상한 (0이면 자동 승인 끔) |
| `approval.max_diff_lines` / `max_diff_files` | 300 / 10 | `diff:within_limit` 기준 |
| `gates.max_consecutive_failures` | 3 | 게이트 연속 실패 상한 |
| `checks.default_timeout_sec` | 600 | check 명령 타임아웃 |
| `checks.log_tail_lines` | 80 | 실패 로그 주입 줄 수 |
| `checks.serialize_per_project` | true | 프로젝트별 check 직렬 실행 |
| `context.token_budget` | 8000 | inline 예산 (S6에서 확정) |
| `context.chars_per_token` | 2.5 | 토큰 추정 계수 |
| `hooks.ipc_timeout_ms` | 3000 | 훅이 앱 응답을 기다리는 시간 |
| `hooks.stop_validation_retries` | 2 | Stop 훅 형식 오류 되돌림 횟수 (D21) |
| `recovery.reconcile_interval_sec` | 30 | 훅 유실 대비 주기 조정 |
| `terminal.font_family` / `font_size` / `scrollback` | Cascadia Mono, D2Coding… / 14 / 10000 | 터미널 |
| `terminal.pty_log_max_mb` | 20 | task별 터미널 기록 상한 |
| `notifications.os` / `sound` | true / false | 알림 |
| `ui.language` / `theme` | ko / system | 화면 |

조정 판단용 기록: 카운트다운 도중 취소 횟수, 자동 승인된 task가 이후 되돌아가기 대상이 된 횟수, 경로 변경 빈도(이벤트로 집계).

---

## 8. 장애와 복구

원칙:
1. **상태의 단일 원천은 `work.json`과 `events.jsonl`이다.** 쓰기 순서는 이벤트 추가(fsync) → work.json 원자적 교체. 시작 시 work.json보다 뒤의 이벤트를 재적용한다.
2. **훅은 편의 신호다.** 진행을 막는 결정에는 훅 없이도 성립하는 신호(PTY 종료, 파일 존재, git 상태)를 함께 쓴다. 훅이 없으면 자동화가 줄 뿐 멈추지 않는다.
3. **복구는 사람에게 선택지를 준다.** 앱이 추측해서 진행하지 않는다(`needs_attention`).

### 8.1 앱 종료와 충돌

| 상황 | 처리 |
|---|---|
| 정상 종료 (창 닫기) | 실행 중 세션이 있으면 확인 대화상자("N개 세션이 중단됩니다. 다음 실행 때 이어서 할 수 있습니다"). 확인하면 각 세션의 프로세스 트리를 종료하고 step `interrupted(app_exit)` 기록 |
| 충돌 / 강제 종료 | 기록할 기회가 없다. 다음 시작 때 조정 |
| 시작 시 조정 | Work마다: ① 이벤트 재적용 ② `running`/`launching` step → 기록된 pid가 살아 있고 명령이 `claude`면 종료(PTY를 다시 붙일 수 없으므로) → `interrupted(app_crash)` ③ task 디렉터리의 handoff를 다시 검증해 유효하면 `awaiting_approval`로 표시(Stop 신호가 없으므로 자동 승인은 안 됨, D30) ④ `running` check gate → 다시 실행(검사는 멱등, 기본값) ⑤ delivery 진행 중이었으면 원격 브랜치와 기존 PR을 확인해 끝난 단계는 건너뜀 ⑥ worktree가 사라졌으면 `git worktree prune` 후 Work를 `needs_attention(session_crashed)`로, 메시지 "worktree가 없습니다" |
| 중단된 task 재개 | [재개] = `claude --resume <session-id>` (화면에는 `pty.log`를 먼저 재생해 이전 맥락을 보여 줌). 재개가 2회 연속 실패하면 `needs_attention(session_crashed)`: [새 세션으로 이 노드 다시] |

### 8.2 CLI 프로세스 종료

| 상황 | 처리 |
|---|---|
| 승인 후 앱이 종료 (D17) | 정상. `exit_grace_sec` 뒤에도 살아 있으면 트리 종료 |
| 사용자가 `/exit` 등으로 종료, 유효 handoff 있음 | `awaiting_approval`. 세션 없이 승인 가능 |
| 종료, handoff 없음 | `ended_no_handoff` → `needs_attention(handoff_missing)` (8.3) |
| 비정상 종료 코드 | 위와 같되 메시지에 종료 코드. 시작 직후(5초 이내) 종료가 반복되면 `session_crashed`(claude 로그인, 버전 확인 안내) |
| `claude` 실행 파일 없음 | step `interrupted`, 도구 점검 화면 안내 |

### 8.3 handoff가 끝내 작성되지 않음

선택지를 이 순서로 보여 준다.
1. **[세션 재개해 마무리]**: `claude --resume <session-id> "/relay-close"` — 시작 인자로 전달하므로 PTY 주입이 아니다. relay-close 스킬이 지금까지의 작업으로 산출물과 handoff를 쓴다.
2. **[새 세션으로 마무리]**: 재개가 안 될 때. 새 세션에 relay-close + 이전 transcript 경로 + task 디렉터리를 주입.
3. **[새 세션으로 이 노드 다시]**: 처음부터.
4. **[다른 노드 선택]**: 현재 task는 `abandoned`.
5. **[handoff 없이 승인…]**(확인 대화상자): 앱이 최소 필드만 채운 handoff("사용자가 handoff 없이 승인함")를 만들고 `forced_invalid: true`로 수동 승인한다. 다음 task에는 이 사실과 산출물 경로만 전달된다.

세션이 살아 있는데 에이전트가 handoff를 쓰지 않는 경우는 장애가 아니다. 사람이 터미널에서 "마무리해 줘"라고 말한다(사람의 입력).

### 8.4 스키마 검증이 계속 실패

1. 에이전트는 `_close`에서 `relay-validate`로 스스로 검사한다.
2. Stop 시점에 앱이 검증하고, 이번 턴에 handoff가 바뀌었는데 형식 오류면 Stop 훅으로 오류를 되돌린다(최대 `stop_validation_retries`회, D21).
3. 그래도 실패하면 승인 버튼을 비활성화하고 [검토] 탭에 오류(필드 경로 + 한국어 설명)를 보여 준다. 사용자는 터미널에서 고쳐 달라고 하거나, [외부 편집기로 열기]로 직접 고친다(파일 변경 감지 → 재검증).
4. 최후 수단 [형식 오류 무시하고 승인…]: `forced_invalid: true`, 자동 승인 불가. 파싱 가능한 필드는 반영하고(decisions 등), 다음 task의 prev-handoff에는 원문을 경고와 함께 주입한다.

### 8.5 사용자가 터미널을 직접 닫음

- 앱 안의 task 탭은 실행 중에 닫을 수 없다(ui.md 2.4). [Task 중단]은 확인을 거쳐 `interrupted`로 만든다.
- 앱 창 자체를 닫는 것은 8.1 정상 종료.
- 사용자가 외부 도구로 `claude` 프로세스를 죽인 경우는 8.2와 같다.

### 8.6 훅 신호 유실

| 잃는 것 | 영향 | 보완 |
|---|---|---|
| Stop | 자동 승인이 시작되지 않음(D30), D21 되돌림 없음 | handoff가 유효하면 [지금 검토]로 수동 승인. 주기 조정(`reconcile_interval_sec`)에서 "handoff가 있는데 턴 종료 신호가 60초 넘게 없음"이면 머리 띠에 안내 |
| Notification | "입력 대기" 배지 부정확 | 없음(표시만의 문제) |
| SessionStart | 세션 ID 확인 불가 | 세션 ID는 앱이 `--session-id`로 정하므로 영향 적음. 10초 내 미수신 시 "훅 미설치" 경고(6.4절 6) |
| 앱 미실행 중 신호 | 훅이 타임아웃 후 조용히 종료, CLI는 막히지 않음 | 시작 시 조정(8.1) |

PTY 출력의 유무(활동 시각)는 안내 문구에만 쓰고 어떤 결정에도 쓰지 않는다(D2).

### 8.7 기타

| 상황 | 처리 |
|---|---|
| check 명령이 멈춤 | 타임아웃 → 프로세스 트리 종료 → 결과 `timeout`(실패로 취급) |
| 사용자가 worktree에서 직접 수정·커밋 | 허용. 앱은 git 상태를 매번 직접 읽으므로 그대로 반영된다. 재현 테스트 파일을 고치면 `repro:intact` 실패로 자동 승인이 멈춘다 |
| 사용자가 worktree 폴더를 삭제 | 8.1 ⑥과 같음 |
| 산출물을 승인 후 수정 | `artifact.modified_after_approval` 경고, 다음 task에 알림 |
| `RELAY_HOME` 디스크 부족 | 쓰기 실패 시 진행을 멈추고 알림. 이벤트 추가가 실패하면 상태를 바꾸지 않는다 |
| 파이프라인 템플릿/스킬이 깨짐 | 로드 검증(P1~P9) 실패 → 그 파이프라인으로 새 Work 생성 불가. 진행 중 Work는 스냅숏을 쓰므로 영향 없음(스킬은 영향 있음 → 세션 시작 전에 relay.json 검증) |

---

## 9. 승인 정책

skill 노드의 `approval`:

- `manual`: 사용자가 [Task 완료]를 눌러야 한다.
- `auto_if_checks`: 아래를 **모두** 만족하면 카운트다운(기본값 15초, 취소 가능) 뒤 자동 승인한다. 판정 절차는 [state-machine.md](contracts/state-machine.md) 6절.
  - handoff 스키마 검증 통과, `status: awaiting_approval`
  - `open_questions` 비어 있음, `intent_deviation` null
  - `requires_human: true`이면서 `by: ai`인 결정 없음
  - `recommended_next`가 null이거나 기본 노드 (D29)
  - handoff 마지막 수정 이후 Stop 신호 수신 (D30)
  - 코드를 쓰는 스킬이면 worktree가 깨끗함
  - 의도 개정 후 stale 산출물이 남아 있지 않음
  - **노드의 `auto_checks`를 앱이 실행해 모두 통과** (D26). 비어 있으면 자동 승인 없음

bugfix 파이프라인 기본값([contracts/examples/bugfix.pipeline.yaml](contracts/examples/bugfix.pipeline.yaml)):

| 노드 | approval | auto_checks |
|---|---|---|
| intake | manual (g-intent와 합침) | — |
| evidence | auto_if_checks | `repro:fails`, `tree:clean` |
| rca | manual | — |
| fix | auto_if_checks | `repro:passes`, `repro:intact`, `tests:unchanged`, `cmd:test`, `tree:clean`, `diff:within_limit` |
| verify | manual (g-done과 합침) | — |

안전장치:
- 연속 자동 승인 상한(기본값 3회)을 넘으면 수동 승인으로 전환한다.
- 카운트다운 중 터미널에 입력하면 멈춘다. 조건이 바뀌면 취소하고 다음 Stop에서 재평가한다.
- 의도 승인(`g-intent`)과 Work 완료(`g-done`)는 설정과 관계없이 항상 사람이 누른다.
- 세션 도중 에이전트의 질문에는 절대 자동으로 답하지 않는다.
- 자동 승인이 안 되는 이유는 항상 조건별로 화면에 보인다(ui.md 2.5).

---

## 10. 벤더 연동 (v1: Claude Code)

벤더별 차이는 `VendorAdapter`에 가둔다(architecture.md 3절).

| 필요 | 방법 | 검증 |
|---|---|---|
| 실행 | node-pty로 `claude --session-id <uuid> --add-dir <work dir> [--settings <task 설정>] "<짧은 첫 프롬프트>"` (6.4절) | S1, S4 |
| 컨텍스트 | `tasks/<nn>/context.md` 파일 + 첫 프롬프트에 경로 (D18) | S4 |
| 스킬 배포 | `<worktree>/.claude/skills/relay-<name>/`로 복사 (D24) | S4 |
| 상태 신호 | 훅 `SessionStart`, `Stop`, `Notification`, `SessionEnd` → `relay-hook.js` | S2 |
| 훅 → 앱 통신 | 로컬 IPC(Windows named pipe, 그 밖은 유닉스 소켓), 한 줄 JSON 요청/응답, 실행마다 새 토큰 ([contracts/hook-ipc.v1.schema.json](contracts/hook-ipc.v1.schema.json)) | S2 |
| 훅 런타임 | `ELECTRON_RUN_AS_NODE=1 "<relay 실행 파일>" relay-hook.js` (D25) | S2 |
| 형식 오류 되돌림 | Stop 훅 응답 `{"decision":"block","reason":...}`, `stop_hook_active`로 반복 방지 (D21) | S2 |
| 레포 밖 쓰기 | `--add-dir` + task 설정의 쓰기 허용 규칙 | S3 |
| 산출물 감지 | 실행 중 task 디렉터리 감시(디바운스 300ms) + 주기 조정 | — |
| 세션 재개 | `claude --resume <uuid>` / 마무리 `claude --resume <uuid> "/relay-close"` | S4 |
| 이전 기록 | 세션 transcript 파일 경로를 `transcripts` 제공자로 전달 | S4 |

relay 파일(`.claude/skills/relay-*`, `.claude/settings.local.json`)은 `.git/info/exclude`로 커밋되지 않게 한다.

---

## 11. Windows 고려사항

- **PTY:** node-pty는 Windows 10 1809+의 ConPTY를 사용한다(VS Code 통합 터미널과 동일).
- **Claude Code:** Windows 네이티브 실행 시 Git for Windows가 필요하다. 첫 실행 도구 점검 화면에서 `claude`, `git`, `gh` 설치와 로그인 여부를 확인하고 안내한다.
- **경로:** 모든 경로는 Node `path` API로 다룬다. 훅과 스크립트는 셸 의존 없이 작성한다. 한글 사용자 이름 경로를 S3에서 확인한다.
- **명령줄:** 첫 프롬프트는 짧게 유지한다(D18). check 명령은 `cmd.exe /d /s /c`로 실행하고, `{file}` 치환 값은 worktree 안 상대 경로인지 검사한 뒤 따옴표로 감싼다.
- **프로세스 종료:** 세션과 check 명령은 프로세스 트리 단위로 종료한다(`taskkill /T /F`).
- **줄바꿈:** 재현 테스트 해시는 LF로 정규화해 계산한다(`core.autocrlf` 영향 제거).
- **배포:** electron-builder로 NSIS 설치 파일. 코드 서명이 없으면 SmartScreen 경고가 표시되므로 v1은 사용 안내 문서로 대응하고 서명은 이후 과제로 둔다.
- **WSL:** v1 지원 범위 밖이다.

---

## 12. 계약

앱, 스킬, 향후 확장이 공유하는 계약은 [`docs/contracts/`](contracts/README.md)에 있다. 변경할 때는 `schema_version`을 올린다.

| 계약 | 파일 |
|---|---|
| Handoff 머리글 | `handoff.v1.schema.json` |
| Intent 머리글 + 본문 규칙 | `intent.v1.schema.json` |
| 파이프라인 템플릿 | `pipeline.v1.schema.json`, 예: `examples/bugfix.pipeline.yaml` |
| Work 상태 | `work.v1.schema.json` |
| 수명주기 이벤트 | `event.v1.schema.json` |
| 프로젝트 설정 | `project.v1.schema.json` |
| 앱 설정 | `config.v1.schema.json` |
| 컨텍스트 manifest | `context-manifest.v1.schema.json` |
| 스킬 manifest | `skill-manifest.v1.schema.json` |
| 훅 IPC | `hook-ipc.v1.schema.json` |
| 상태 기계 규칙 | `state-machine.md` |

---

## 13. v1 스킬 (버그 수정 파이프라인)

명세: [`docs/skills/`](skills/README.md). 모든 스킬은 같은 골격(목적 / 입력 / 결정 지점 / 절차 / 완료조건 / 산출물 템플릿 / handoff 확장 / 하지 말 것 / relay.json)을 따른다.

| 스킬 | 사람에게 묻는 결정 (질문 예산) | 산출물 | 완료조건 |
|---|---|---|---|
| `work-start` | 목표 이해, 완료조건, 비목표, 규모, delivery, 제약 (≤6, 한 번에) | `intent.draft.md` | 스키마 통과, 완료조건이 검증 가능 |
| `evidence` | 재현에 필요한 정보, 수동 재현 허용 (≤2, 필요할 때만) | `evidence.md` + 재현 테스트 커밋 | 재현 여부 명시, 재현 테스트는 커밋되고 실패함 |
| `root-cause` | 가설 채택, 수정 방향 (≤2) | `rca.md` | 원인이 증거로 뒷받침, 기각 가설과 근거 |
| `fix` | 계획 이탈 시에만 (≤1) | 코드 커밋 + `fix.md` | 재현 테스트 통과·무변경, 테스트 통과, 커밋 완료 |
| `final-verify` | 판정 애매한 완료조건 (≤1) | `verification.md` (+ `pr.md`) | 완료조건별 판정과 증거, 테스트 약화 점검 |
| `intent-revise` | 변경 내용, 무효 산출물, 재개 노드 (≤3) | `intent.draft.md` + `intent.diff.md` | 영향 분석이 승인된 산출물 전부를 다룸 |
| (공통) `_close` | — | `handoff.md` | 스키마 준수, 검증 명령 통과 |

---

## 14. 스파이크

실행 계획: [`docs/spikes.md`](spikes.md).

| # | 확인할 것 | 결과가 바꾸는 것 |
|---|---|---|
| S1 | Windows에서 Electron + node-pty + xterm.js로 `claude` TUI 사용(한글 IME 포함) | D1/D8 전제. 실패 시 외부 터미널 방식 재검토 |
| S2 | 훅 주입 방식(`--settings` / settings.local.json), Node 없는 환경의 훅 실행, 신호 지연, Stop 차단 | 6.4절 3, D21, D25 |
| S3 | 레포 밖 산출물 쓰기(권한 규칙의 Windows 경로 표기) | D10 구현 방식(대안: 정션) |
| S4 | 짧은 첫 프롬프트로 스킬 트리거 + context.md 인지, 재개 + 프롬프트 | D18, 8.3 복구 흐름 |
| S5 | (선택) Codex CLI 동일 항목 | D9 |
| S6 | 컨텍스트 토큰 예산 실측 | `context.token_budget` |

---

## 15. 열린 질문

- 토큰 예산 기본값 → S6
- 훅 설정 주입 방식(`--settings` 우선, 안 되면 settings.local.json) → S2
- 쓰기 허용 규칙의 Windows 경로 표기, 실패 시 정션 대안 채택 여부 → S3
- 스킬 트리거 방식(슬래시 / 자연어 / 스킬을 context.md에 포함) → S4
- Codex v1 포함 여부 → S5
- 기본 브랜치가 앞서 나간 경우의 정책(알림만 / verify 전 병합 제안) → M3 사용 후
- 작은 work용 `quickfix` 파이프라인(intake와 fix를 한 세션에서) 필요 여부 → M3 사용 후
- 버그 수정 다음 파이프라인(기능 개발)의 노드 구성 → M3 이후

해결됨 (v0.2): check 명령 등록 → D33, PR 생성 방식과 `gh` → D19, 여러 Work 동시 실행 → D20, 스키마 오류 되돌림 → D21, 재현 테스트 고정 → D23
해결됨 (v0.1.1): worktree 위치 → D13, 브랜치 처리 → D15, 카운트다운과 연속 상한 → 설정값(7.5절)

---

## 16. 로드맵

1. **M0:** 스파이크 S1~S4, S6 → 이 문서에 반영 (S5는 선택)
2. **M1:** 프로젝트 등록(자동 탐지), Work 생성(worktree, setup), PTY 터미널과 `pty.log` 재생, 훅 신호, 상태 배지, 동시 Work와 세션 상한, 앱 종료/충돌 복구, Work 정리
3. **M2:** 버그 수정 파이프라인 전체(스킬 6종 + `_close`, handoff 검증과 Stop 되돌림, human/check 게이트, 재현 테스트 고정, 승인 정책과 카운트다운, 경로 변경 메뉴, 의도 개정, delivery)
4. **M3:** 실제 사용 → 스킬 개선, 기본값 조정(카운트다운, 연속 상한, diff 한도, 질문 예산), 우회 경로 집계로 transitions 보강
5. **이후:** 지식 추출(`task.approved` 구독) + `knowledge` 제공자, `review` 게이트, 추가 파이프라인, Codex

---

## 17. 변경 이력

### v0.2 (2026-09-25)

- 문서 분리: ui.md, architecture.md, contracts/, skills/, spikes.md
- 결정 D3·D15 개정, D17~D37 추가 (2절). 이 중 D19·D20·D21·D23은 사용자 결정
- v0.1.1 비판적 검토 결과와 위험 대책 표 추가 (3절)
- `deliver` 스킬 제거 → 앱이 delivery 수행. 스킬 7종 → 6종 + `_close`
- 파이프라인: `fast_path` → `when`, `auto_checks`, `on_pass`, 선택 입력 `?`, 스냅숏
- handoff: `status` 두 값으로 축소, `git`/`checks` 제거, `self_checks`와 스킬별 확장(`pipeline_fit`, `repro`, `intent_revision`, `delivery_draft`) 추가
- 이벤트: `task.rejected` 제거, `task.interrupted`·`task.ended_no_handoff`·`approval.*`·`repro.*`·`delivery.*` 등 추가
- 컨텍스트 제공자 7 → 16 (rejected-log, handoff-chain, transcripts 등)
- 새 절: 프로젝트 등록과 `project.json`, Work 수명주기, 앱 설정, 장애와 복구, 화면 설계, 모듈 구조와 테스트 전략
- 열린 질문 해소: 테스트 명령 등록(D33), PR 생성 방식(D19)

### v0.1.1

- 경로 변경, intent-revise, delivery, Work 정리 추가
