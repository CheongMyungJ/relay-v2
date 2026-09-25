# 앱 구조와 테스트 전략 (v1)

design.md의 결정을 코드 구조로 옮긴 것이다. 언어는 TypeScript, 빌드는 electron-vite, 배포는 electron-builder(NSIS)로 한다(기본값).

---

## 1. 프로세스 구성

```
┌──────────────────────── Electron 메인 프로세스 (Node) ────────────────────────┐
│  core/ (순수 로직, Electron·fs 의존 없음)   infra/ (부수 효과)                  │
│   PipelineEngine  ApprovalEvaluator        Store  GitService  CheckRunner      │
│   WhenParser  ContextAssembler+Providers   SessionManager(node-pty)            │
│   Validators(ajv)  HandoffParser           HookServer  ArtifactWatcher         │
│                                            SkillInstaller  DeliveryService     │
│                    app/                    ToolDetector  Notifier              │
│   WorkController(Work별 직렬 큐) · RecoveryService · EventBus · IpcApi          │
└───────────────▲──────────────────────────────▲──────────────────────────────┘
                │ ipcRenderer.invoke / events   │ MessagePort (PTY 바이트, 세션별)
┌───────────────┴──────── preload (contextBridge, 타입 있는 API만 노출) ─────────┐
└───────────────▲──────────────────────────────────────────────────────────────┘
┌───────────────┴──────── 렌더러 (React, 기본값) ───────────────────────────────┐
│  Sidebar · WorkView(Stepper, TaskTabs, Terminal(xterm)) · RightPanel · Dialogs  │
└────────────────────────────────────────────────────────────────────────────────┘

외부 프로세스:  claude (PTY 안)  ──훅──▶  relay-hook.js (ELECTRON_RUN_AS_NODE) ──named pipe──▶ HookServer
               check 명령, git, gh (CheckRunner / GitService / DeliveryService가 실행)
```

- 렌더러는 파일 시스템과 프로세스에 접근하지 않는다(`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
- PTY 데이터는 양이 많으므로 invoke가 아니라 세션별 `MessagePort`로 흘린다. 렌더러의 키 입력도 같은 포트로 보낸다(사람 입력의 전달이지 자동 주입이 아니다).
- 앱은 **단일 인스턴스**다(`requestSingleInstanceLock`). 두 인스턴스가 같은 `RELAY_HOME`을 쓰면 상태가 깨지기 때문이다.

---

## 2. 모듈과 책임

### 2.1 core (순수)

| 모듈 | 책임 | 입력 → 출력 |
|---|---|---|
| `PipelineEngine` | state-machine.md 규칙 구현. 다음 노드, 게이트 결과 처리, 경로 변경, 의도 개정 | `(WorkState, Pipeline, Intent, Signal) → { state, events[], effects[] }` |
| `WhenParser` | `when` 식 파싱·평가. 임의 코드 실행 없음 | 문자열 → AST → bool |
| `ApprovalEvaluator` | 자동 승인 공통 조건 + auto_checks 결과 판정 | handoff, step, checkResults → `{eligible, blocking[]}` |
| `ContextAssembler` | 제공자 호출, 우선순위·예산에 따라 inline/path 결정, `context.md`와 manifest 생성 | TaskLaunchContext → `{contextMd, manifest, firstPrompt}` |
| `providers/*` | 제공자 하나당 파일 하나 (design.md 6.5 표) | TaskLaunchContext → ContextFragment[] |
| `Validators` | 모든 계약 스키마(ajv, draft 2020-12) + 스키마 밖 규칙(P1~P9, intent 본문 절, 스킬 produces) | 객체 → 오류 목록(사람이 읽을 한국어 메시지) |
| `HandoffParser` | front matter 분리(BOM, CRLF 허용), YAML 1.2 core 스키마로 파싱(날짜를 문자열로 유지) | 텍스트 → `{frontmatter, body}` |

`effects`는 엔진이 요청하는 부수 효과 목록이다(예: `StartSession`, `RunChecks`, `KillSession`, `Deliver`, `Notify`). 엔진은 실행하지 않고 기술만 한다. 그래서 엔진 테스트에 프로세스나 파일이 필요 없다.

### 2.2 infra (부수 효과)

| 모듈 | 책임 |
|---|---|
| `Store` | `RELAY_HOME` 읽기/쓰기. 쓰기 순서: `events.jsonl` 추가(fsync) → `work.json` 임시 파일 쓰기 → rename. 시작 시 `work.json`의 마지막 seq보다 뒤에 있는 이벤트를 재적용 |
| `GitService` | worktree 생성/제거, `core.longpaths`, `.git/info/exclude` 관리, status/diff/hash 계산, 브랜치 병합·push 여부 확인 |
| `CheckRunner` | 셸로 등록 명령 실행, 타임아웃, 프로세스 트리 종료(Windows `taskkill /T /F`), 로그 저장, 결과 캐시, 프로젝트별 직렬 큐 |
| `SessionManager` | node-pty spawn/kill, 환경 변수(`RELAY_*`), `pty.log` 기록, MessagePort 연결, 살아 있는 세션 수 상한, 종료 감지 |
| `VendorAdapter` | 벤더별 차이를 가두는 인터페이스: 실행 인자 만들기, 재개 인자, 훅 설정 파일 생성, 권한 설정 생성, transcript 경로 찾기. v1 구현은 `ClaudeCodeAdapter` 하나 |
| `HookServer` | named pipe/유닉스 소켓 서버, 토큰 검사, `hook-ipc.v1` 메시지 처리, Stop 요청에 대해 WorkController에 동기 질의 후 `none`/`block` 응답 |
| `ArtifactWatcher` | 실행 중 task 디렉터리 감시(chokidar, 300ms 디바운스), handoff 변경 시 파싱·검증 요청 |
| `SkillInstaller` | 세션 시작 전 `.claude/skills/relay-*` 복사, task 전용 settings 파일 생성(S2 결과에 따라 `--settings` 또는 `settings.local.json`), exclude 등록 |
| `DeliveryService` | `git push`, `gh pr create`, `gh auth status` 확인 |
| `ToolDetector` | `claude`, `git`, `gh` 경로와 버전 탐지, 최소 버전 검사 |
| `Notifier` | OS 알림, 작업 표시줄 배지 |

### 2.3 app (조립)

| 모듈 | 책임 |
|---|---|
| `WorkController` | Work마다 **직렬 명령 큐**(액터). 신호(훅, 파일 변경, PTY 종료, 버튼)를 받아 엔진 호출 → 이벤트 저장 → effects 실행. 같은 Work의 신호가 동시에 처리되어 생기는 경쟁을 원천 차단 |
| `RecoveryService` | 시작 시 조정(design.md 8.1), 주기적 조정(`reconcile_interval_sec`: 훅 유실 대비 handoff mtime·PTY 생존 확인) |
| `EventBus` | 저장된 이벤트를 구독자에게 발행. 구독자: 렌더러 브리지, Notifier, 통계(카운트다운 취소 수, 자동 승인 후 되돌아감 수), 향후 지식 추출 |
| `IpcApi` | 렌더러용 명령(`work.create`, `task.approve`, `work.reroute` …)과 조회. 모든 명령은 WorkController 큐를 거친다 |

### 2.4 번들되는 보조 스크립트

| 파일 | 실행 주체 | 역할 |
|---|---|---|
| `relay-hook.js` | Claude Code 훅 | stdin JSON → 파이프 요청 → 응답을 훅 출력 형식으로 변환. 의존성 없음. 앱 미응답 시 조용히 종료 |
| `relay-validate.js` | 에이전트(`_close` 3단계) | handoff/intent 파일을 앱과 **같은 검증 코드**로 검사(core/Validators를 번들). 사람이 읽을 오류 출력 |

둘 다 `ELECTRON_RUN_AS_NODE=1 "<relay 실행 파일>" <스크립트>`로 실행한다. 사용자 PC에 Node가 없어도 동작해야 하기 때문이다(D25, S2-3에서 확인). 이 환경 변수는 명령 한 줄에만 붙이고 PTY 환경에는 넣지 않는다(에이전트가 다른 Electron 앱을 실행할 때 영향이 없도록).

---

## 3. 주요 인터페이스 (초안)

```ts
// core
type Signal =
  | { kind: "handoff_changed"; stepId: string; parsed: ParsedHandoff; mtime: string }
  | { kind: "turn_stopped"; stepId: string; at: string }          // Stop 훅
  | { kind: "input_waiting"; stepId: string; at: string }         // Notification 훅
  | { kind: "pty_exited"; stepId: string; exitCode: number | null }
  | { kind: "checks_done"; stepId: string; results: CheckResult[] }
  | { kind: "user"; action: UserAction };                          // 버튼, 메뉴

type Effect =
  | { kind: "StartSession"; stepId: string; resume?: { sessionId: string; prompt?: string } }
  | { kind: "KillSession"; stepId: string }
  | { kind: "RunChecks"; stepId: string; checks: CheckRef[] }
  | { kind: "LockRepro"; stepId: string; file: string }
  | { kind: "StartCountdown" | "CancelCountdown"; stepId: string }
  | { kind: "Deliver"; mode: "push" | "pr" }
  | { kind: "RemoveWorktree"; deleteBranch: boolean }
  | { kind: "Notify"; level: "info" | "attention"; message: string };

interface ContextProvider {             // design.md 6.5
  id: string;
  priority: number;
  appliesTo?(ctx: TaskLaunchContext): boolean;
  provide(ctx: TaskLaunchContext): Promise<ContextFragment[]>;
}

// infra
interface VendorAdapter {
  id: "claude" | "codex";
  buildLaunch(opts: LaunchOpts): { file: string; args: string[]; env: Record<string, string> };
  buildResume(sessionId: string, prompt?: string): { file: string; args: string[] };
  writeSessionSettings(task: TaskPaths, hookCmd: string, allowWrite: string[]): Promise<string>;
  transcriptPath(sessionId: string, cwd: string): string | null;
}
```

---

## 4. 디렉터리 구조 (코드 레포, 예정)

```
src/
  core/          engine/  approval/  context/  providers/  validate/  parse/
  infra/         store/  git/  checks/  session/  vendor/claude/  hooks/  watch/  skills/  delivery/
  app/           controller/  recovery/  events/  ipc/
  preload/
  renderer/      components/  views/  state/  terminal/
  scripts/       relay-hook.ts  relay-validate.ts
resources/
  skills/        work-start/ evidence/ root-cause/ fix/ final-verify/ intent-revise/ close/
  pipelines/     bugfix.yaml
  schemas/       *.v1.schema.json   (docs/contracts에서 복사, 단일 원천은 docs/contracts)
test/
  fixtures/      handoffs/ intents/ pipelines/ repos/
  fake-claude/   가짜 CLI
  e2e/
```

첫 실행 시 `resources/skills`, `resources/pipelines`를 `RELAY_HOME`으로 복사한다. 이미 있으면 버전을 비교해 relay가 배포한 파일만 갱신하고, 사용자가 고친 파일은 `.user` 표시가 있으면 건드리지 않는다(기본값).

---

## 5. 테스트 전략

벤더 CLI는 자주 바뀌고 실제 모델 호출은 느리고 비싸다. 그래서 **결정 로직은 순수 코드로 촘촘히**, **벤더 경계는 가짜 CLI로**, **실제 CLI는 좁은 스모크로** 나눈다.

| 층 | 대상 | 방법 | 실행 |
|---|---|---|---|
| 단위 | PipelineEngine | state-machine.md의 전이 표를 그대로 옮긴 **표 기반 테스트**. 표의 행 하나 = 테스트 하나. 8절 흐름 예시는 시나리오 테스트 | 매 커밋 |
| 단위 | WhenParser, ApprovalEvaluator, ContextAssembler | 경계값(예산 초과 강등, 85 이상 강등 금지, 빈 auto_checks) | 매 커밋 |
| 계약 | 스키마 | 모든 `*.schema.json` 컴파일, `examples/`와 `test/fixtures/`의 유효/무효 샘플 검증, 스킬 `relay.json` 검증, bugfix.yaml P1~P9 | 매 커밋 |
| 계약 | 문서 일치 | 스킬 명세의 relay.json 블록과 `resources/skills/*/relay.json`이 같은지 | 매 커밋 |
| 통합 | GitService, CheckRunner | 임시 git 레포 실제 생성. 타임아웃·트리 종료·캐시·CRLF 해시 | 매 커밋, **Windows + Linux** CI |
| 통합 | HookServer ↔ relay-hook.js | 실제 스크립트 프로세스로 요청/응답, 토큰 오류, 앱 무응답 시간 초과 | 매 커밋, Windows + Linux |
| 통합 | Store 복구 | 이벤트 추가와 work.json 쓰기 사이에서 강제 종료(오류 주입) → 재시작 후 상태 일치 | 매 커밋 |
| E2E | 앱 전체 | Playwright `_electron` + **fake-claude** + 임시 `RELAY_HOME` | PR마다 |
| 스모크 | 실제 Claude Code | S1~S4 핵심 항목 체크리스트(수동 + 일부 자동) | 릴리스 전, Claude Code 주요 업데이트 후 |

### 5.1 fake-claude

실제 CLI와 같은 인자(`--session-id`, `--resume`, `--settings`, `--add-dir`, 위치 인자 프롬프트)를 받는 Node 스크립트. 시나리오 파일(YAML)대로 동작한다.

```yaml
# test/fake-claude/scenarios/fix-happy.yaml
- print: "수정 중..."
- commit: { file: src/a.ts, content: "...", message: "relay(fix): ..." }
- write: { path: "$RELAY_TASK_DIR/fix.md", from: fixtures/fix.md }
- write: { path: "$RELAY_TASK_DIR/handoff.md", from: fixtures/handoffs/fix-valid.md }
- hook: Stop                    # settings 파일의 훅 명령을 실제로 실행
- wait_input: true              # 사람 입력을 기다리는 척(Notification 훅)
- exit: 0
```

settings 파일에서 훅 명령을 읽어 실제로 실행하므로, HookServer·relay-hook.js·엔진·UI가 실제 경로로 연결된 상태를 검증한다.

### 5.2 E2E 시나리오 (최소)

1. M 크기 정상 경로(자동 승인 2회 포함) → Work 완료(delivery: none)
2. g-tests 3회 연속 실패 → `needs_attention` → [다른 노드 선택]
3. handoff 형식 오류 → Stop 훅 되돌림 2회 → 3번째에 패널 오류 표시 → [형식 오류 무시하고 승인]
4. task 실행 중 앱 강제 종료 → 재시작 → `interrupted` → [재개]
5. CLI가 handoff 없이 종료 → [세션 재개해 마무리]
6. 실행 중 [다음 단계 변경] → 기타 스킬 임시 노드 → 원래 위치로 복귀
7. intent_deviation → [의도 수정] → stale 표시 → resume_node에서 재개
8. 두 Work 동시 실행 + 세션 상한 도달 시 대기

### 5.3 하지 않는 것

- 실제 모델 출력 품질의 자동 평가(스킬 품질은 M3의 실제 사용과 S6 방식의 수동 비교로 본다).
- 터미널 화면 스냅숏 비교(화면은 파싱하지 않는다는 D2와 같은 이유).
