# relay-v2 구현 계획

- 대상 설계: `docs/design.md` v0.4 (MVP)
- 상태: 정함. 주제마다 사람과 문답으로 정했다(설계 부록 A의 진행 규칙). 바꾸려면 사용자와 다시 정한다.

## 0. 목표와 범위

- 설계 v0.4를 구현하는 순서와 방법을 정한다. 앱 코드는 이 문서를 정한 뒤에 쓴다.
- **첫 목표:** Work 하나가 intake부터 verify, Work 완료까지 끝까지 가는 최소 흐름. 되감기, 자동 승인, 복구는 그 뒤에 넣는다.
- 설계를 바꾸는 결정은 `docs/design.md` 2절 결정 표에 적는다. 이 문서의 결정 표(I 번호)에는 구현 방법만 적는다.

표기: 근거가 약한 초기값은 **(기본값)**으로 표시한다. **사용자 결정** 열에 ✅가 있는 항목은 사용자가 직접 정한 것이다.

## 1. 주제와 순서

한 번에 한 주제씩 정한다. 앞 주제의 결정이 뒤 주제의 전제가 되도록 순서를 잡았다.

| # | 주제 | 정할 것 | 상태 |
|---|---|---|---|
| 1 | 기술 선택 | 언어, Electron 프로세스 구성, 빌드 도구, UI 라이브러리, 테스트 도구, 패키지 관리, 레포 배치, 배포 | 정함 |
| 2 | 모듈 구조 | 저장소(5.1), 상태 기계(3.3), task 실행(PTY, 훅 서버, 설정 파일 생성), 형식 검사(5.2.1), git 작업(worktree, 되감기, 전달), 화면. 모듈 사이 경계와 IPC | 정함 |
| 3 | 스파이크 코드 재사용 | `spikes/lib`와 `skills/check.mjs`에서 가져다 쓸 것과 새로 쓸 것 | 정함 |
| 4 | 마일스톤 | 만드는 순서와 마일스톤마다의 완료 기준. 최소 흐름을 먼저 세로로 관통한다 | 정함 |
| 5 | 테스트 전략 | 단위 테스트, 러너 통합 시험, 실기 확인의 나눔과 비용 | 정함 |
| 6 | 설계의 빈 곳 | 1~5를 정하며 찾은 설계의 빈 곳과 어긋난 곳(9절) | 정함 |

## 2. 결정

| # | 결정 | 이유 | 사용자 결정 |
|---|---|---|---|
| I1 | 앱은 TypeScript(strict)로 쓴다 | 상태와 전이, `work.json`, IPC 메시지를 타입으로 묶어 메인과 렌더러의 어긋남을 컴파일 때 잡음 | ✅ |
| I2 | 메인 프로세스가 PTY, 훅 서버, 저장소, git, 파일 감시를 모두 맡는다. 렌더러는 화면만 그리고 preload가 `contextBridge`로 내보낸 좁은 API로만 요청한다 | 세션이 최대 3개라 부하가 작음. node-pty는 스레드 안전하지 않아 한 곳에서 씀. 프로세스가 하나면 재시작 때 상태 조정(시나리오 9)이 단순함 | ✅ |
| I3 | 빌드는 electron-vite(메인·preload·렌더러 번들)로, 패키징은 electron-builder로 한다 | 설계가 정한 electron-builder NSIS(7절)와 역할이 겹치지 않음. Electron Forge는 자체 패키징 도구가 중심임 | ✅ |
| I4 | 화면은 React로 쓴다. 컴포넌트 라이브러리 없이 CSS를 직접 쓴다 **(기본값)** | 화면 상태가 많고(배지 우선순위, 승인 화면 탭, 단계 선택, 카운트다운) xterm.js를 컴포넌트로 감싼 예가 많음 | ✅ |
| I5 | 단위 테스트는 Vitest로 한다 | electron-vite와 같은 Vite 설정으로 TypeScript를 바로 돌림 | ✅ |
| I6 | 패키지 관리는 npm으로 하고 lockfile을 커밋한다 | `spikes/`, `skills/`와 같음. pnpm의 심볼릭 링크 배치는 electron-builder와 네이티브 모듈 조합에서 추가 설정이 필요할 수 있음 | ✅ |
| I7 | 앱은 레포의 `app/` 디렉터리에 독립 패키지로 둔다. 스킬 원본 `skills/`는 빌드 때 앱에 함께 넣는다 | 폴더마다 독립 패키지인 지금 구조와 같고, 스파이크 의존성이 앱에 섞이지 않음 | ✅ |
| I8 | 배포는 electron-builder NSIS, x64, 사용자별 설치(관리자 권한 불필요)로 한다. 서명과 자동 업데이트는 없다. 설치 파일은 GitHub Actions Windows 러너의 수동 워크플로로 만들어 결과물로 올린다 | MVP 사용자는 한 명이라 릴리스 절차가 필요 없음. 러너 빌드로 설치 파일 안의 node-pty 동작도 시험함 | ✅ |
| I9 | 코드는 층으로 나눈다: `core`(순수 로직), `adapters`(바깥 세계), `main`(조립), `preload`, `renderer`, `shared`(타입). `core`는 Node와 Electron API를 import하지 않는다 | 규칙이 가장 많은 곳(상태, 형식 검사, 되감기 계산)을 Electron과 `claude` 없이 Vitest로 싸게 시험함 | ✅ |
| I10 | 상태 기계는 순수 함수 `(상태, 이벤트) → (새 상태, 할 일 목록)`이다. 할 일은 `main`이 실행한다. 라이브러리는 쓰지 않는다 | 훅 신호, 사람 버튼, 재시작 조정이 같은 함수를 지나 설계의 표를 그대로 테스트로 옮김. 상태 수가 적음 | ✅ |
| I11 | 상태의 기준은 `work.json`이다. 전이마다 원자적으로 쓰고 메모리 상태는 캐시로 본다 | 설계(5.1, D75, D77)가 `work.json` 기준으로 재시작을 정의함. 전이는 사람 속도라 매번 써도 부담이 없음 | ✅ |
| I12 | `git`과 `gh`는 CLI를 `execFile`로 부르는 얇은 래퍼로 쓴다 | worktree와 사용자의 git 설정·자격 증명이 그대로 쓰임. git은 이미 필수(7절). 쓰는 명령이 적음 | ✅ |
| I13 | 훅 서버는 앱 시작 때 `127.0.0.1` 임의 포트에 하나 띄운다. URL은 `/hook/<task-id>/<Event>`이고, task마다 무작위 토큰을 `Authorization` 머리글로 받는다. 토큰은 PTY 환경 변수 `RELAY_HOOK_TOKEN`으로 넘기고 설정 파일에는 변수 이름만 적는다(`headers`, `allowedEnvVars`). 토큰이 틀린 요청은 무시한다 | 다른 프로세스가 가짜 신호를 보낼 수 없고 토큰이 파일에 남지 않음. URL만 보고 task를 알 수 있음. 포트가 바뀌어도 재개할 때 설정 파일을 새로 만들면 됨 | ✅ |
| I14 | 렌더러는 명령을 `invoke`로 보낸다. 메인은 상태가 바뀔 때마다 Work 단위 스냅샷을 보낸다. 터미널 출력은 task별 채널로 보낸다 | 상태의 기준이 메인 한 곳이고, 화면은 받은 것을 그리기만 해 어긋나지 않음 | ✅ |
| I15 | 실행 중인 task 디렉터리를 `fs.watch`로 보고 디바운스해 검사한다. Stop을 받으면 감시와 상관없이 다시 읽어 검사한다 | 판정의 기준은 Stop 때의 재검사라 감시는 화면을 빨리 바꾸는 용도임. 놓쳐도 결과가 틀리지 않음 | ✅ |
| I16 | 앱 코드는 TypeScript로 새로 쓰되, 스파이크에서 확인한 세부는 그대로 옮기고 출처를 주석에 남긴다. `spikes/`는 그대로 둔다 | 스파이크 코드는 시험 편의 코드와 섞여 있음. 러너에서 확인한 세부를 버리면 같은 시행착오를 다시 겪음 | ✅ |
| I17 | 화면 읽기(xterm headless), 첫 실행 창 자동 수락, 테스트용 레포 만들기는 앱에 넣지 않고 통합 시험 도구(`app/test/`)로만 옮긴다 | 앱은 첫 실행 창을 건드리지 않음(D69). 통합 시험에서 `claude`를 실제로 띄우려면 필요함 | ✅ |
| I18 | `skills/check.mjs`는 스킬 작성용으로 그대로 둔다. 앱 형식 검사(`core/validate`)는 따로 쓰고, 앱 테스트가 `_common.md`와 `work-start`의 템플릿 예시를 앱 검사기에 넣어 통과를 확인한다(D87) | 두 코드가 보는 대상이 다름. 스킬과 앱이 어긋나면 앱 테스트가 실패해 드러남. 공통 모듈을 두면 `skills/`가 앱 빌드에 묶임 | ✅ |
| I19 | 스키마 원본은 `docs/contracts/*.schema.json`이다. 빌드 때 앱으로 복사하고 TypeScript 타입은 `json-schema-to-typescript`로 생성한다 | 설계(D84)가 이 파일을 원본으로 정함. 생성하면 타입과 스키마가 어긋나지 않음 | ✅ |
| I20 | 프로세스 ID의 시작 시각은 PowerShell `Get-CimInstance Win32_Process`로 조회한다. 세션을 띄운 직후와 재시작 때만 부른다 | 러너에서 동작을 확인함(S1). 느리지만(1초 안팎) 드물게 부름 | ✅ |
| I21 | 골격과 배포(M0)를 core(M1)보다 먼저 만든다 | 설치 파일 안의 node-pty가 안 되면 기술 선택(I3, I8)을 다시 봐야 함. 가장 쌀 때 먼저 확인함 | ✅ |
| I22 | 최소 흐름(M2)은 한 Work, 수동 승인, [완료만] 전달이다. 형식 오류 되돌림(D21)은 넣고, 이전 단계 추천(D23)은 멈추고 알리기만 한다 | 되돌림은 Stop 응답 하나라 비용이 작고, 없으면 형식 오류마다 사람이 다시 시켜야 함. 멈추지 않으면 D23을 어김. push는 M5 전까지 사람이 worktree에서 직접 할 수 있음 | ✅ |
| I23 | M3 뒤의 순서는 되감기(M4) → 전달과 정리(M5) → 복구(M6) → 자동 승인(M7)이다 | verify가 실패하면 되감기 없이는 Work를 새로 만들어야 함. 전달은 사람이 직접 push하면 되고, 복구는 M3의 기본 처리(D75, D78)로 대부분 넘어감. 자동 승인은 수동 승인을 써 본 뒤 넣음(설계 0절 3항) | ✅ |
| I24 | M3가 끝나면 실제 버그에 쓰기 시작한다. 쓰면서 나온 불편으로 M4~M7의 순서를 다시 정한다 | M3부터 중단·재개와 여러 Work가 되어 쓸 만함. M2는 중단 수단이 없어 실사용에 위험함. 자동화는 써 보고 불편이 확인된 뒤 넣는다는 설계 규칙과 맞음 | ✅ |
| I25 | 앱 흐름 시험에는 Node 스크립트로 만든 가짜 `claude`를 쓴다. 실제와 같은 인자를 받아 PTY 안에서 돌고, 설정 파일의 훅 URL과 토큰으로 신호를 보내고, 시나리오 파일대로 산출물과 handoff를 쓰고, Stop 되돌림을 받으면 고쳐 쓴다 | 비용이 없고 결과가 매번 같음. PTY, 훅 서버, 토큰, 감시, 되돌림까지 실제 경로를 지남. 실제와 어긋나는 것은 실제 `claude` 시험(I29)이 잡음 | ✅ |
| I26 | 앱 흐름 시험은 Electron 없이 Vitest(Node)에서 `main`의 조립 코드를 불러 돌린다. 창, 알림, 렌더러로 보내기는 주입받게 하고 시험에서는 가짜로 바꾼다 | 흐름 시험의 대상은 상태, 파일, 프로세스임. 화면을 거치면 느리고 흔들림. I9의 층 나눔과 맞음 | ✅ |
| I27 | 화면과 설치 파일은 Playwright(`_electron`)로 스모크 시험만 한다: 설치된 앱이 뜬다, 탭에 PTY 출력이 보인다, 가짜 `claude`로 task 하나를 승인까지 누른다. 설치 파일 워크플로에서 돌린다 | 설치 파일 안의 node-pty(M0)를 자동으로 확인하려면 설치된 앱을 띄워야 함. Electron 지원이 실험적이라 범위를 좁게 둠 | ✅ |
| I28 | push와 PR마다 두 작업을 돌린다. Linux: 타입 검사, lint(ESLint, Prettier **(기본값)**), core 단위 시험. Windows: adapters 시험과 가짜 `claude` 흐름 시험. 설치 파일 빌드와 스모크, 실제 `claude` 시험은 수동으로 돌린다 | 공개 레포라 러너가 무료임. core는 Node API를 쓰지 않아 Linux에서 빨리 결과가 나옴. 주 플랫폼 문제는 Windows 작업이 잡음. 설치 파일 빌드는 오래 걸림 | ✅ |
| I29 | 실제 `claude` 흐름 시험은 수동 워크플로로, 마일스톤 완료 때와 Claude Code를 올릴 때 돌린다. 시험 레포 두 개(M 경로, S 경로)를 시험 때 만들고 **(기본값)**, 질문에는 첫 선택지로 답한다. 모델과 effort는 입력으로 받고 기본은 `sonnet`, `low`다 **(기본값)**. 끝까지 갔는지, task마다 되돌림 횟수, 걸린 시간을 판정한다 | 한 번에 세션이 8개 돌아 Claude 사용량이 가장 큰 시험임. 스킬이나 Claude Code가 바뀔 때만 의미가 있음. 되돌림 횟수는 스킬 템플릿이 잘 맞는지 보는 지표도 됨 | ✅ |
| I30 | 마일스톤마다 실기 확인 항목을 7절에 두고, 실제 `claude` 시험과 실기 확인의 결과는 `docs/checks.md`에 날짜, 앱 커밋, Claude Code 버전, OS와 함께 기록한다 | 스파이크 결과(D92)와 같은 방식. Claude Code 버전이 바뀌었을 때 무엇을 다시 확인할지 알 수 있음 | ✅ |
| I31 | 스파이크 S6(강제 종료 뒤 `--resume`)을 M3 전에 러너에서 돌린다. 계획은 `docs/spikes.md`에 둔다 | [즉시 중단]은 트리 종료인데 S3는 `/exit`로 끝낸 세션만 확인함. 결과에 따라 M3의 설계가 바뀔 수 있어 먼저 알아야 함 | ✅ |
| I32 | PTY는 `useConpty: true`, `useConptyDll: true`로 띄운다. node-pty에 들어 있는 `conpty.dll`과 `OpenConsole.exe`를 쓰고 Windows 내장 ConPTY는 쓰지 않는다 | DLL 모드는 세션을 시작한 직후 의사 콘솔을 놓아(`ConptyReleasePseudoConsole`) 세션이 끝나면 `OpenConsole.exe`도 스스로 끝남. 내장 ConPTY는 트리 종료 뒤에도 `conhost.exe`가 남을 수 있음(3절). Windows 10과 11에서 같은 ConPTY를 씀. 스파이크 S1~S5는 내장 ConPTY로 확인했으므로 M0의 [실기]에서 다시 확인함 | ✅ |
| I33 | Linux에서 프로세스의 시작 시각(D76)은 `/proc/<pid>/stat`의 starttime을 CLK_TCK로 나누고 `/proc/stat`의 btime을 더해 만든다. 고아 트리는 `/proc`의 부모 관계로 모아 SIGKILL로 끝낸다 | Linux는 시험 환경뿐이지만 로컬 `npm test`가 [어댑터]와 [흐름]을 돌린다. 시작 시각이 없으면 재사용된 ID를 가리지 못해 고아를 확인할 수 없음. Linux에서도 다른 프로세스가 PTY의 master를 쥐고 있으면 앱이 꺼져도 세션이 살아남았음(3절) | ✅ |

## 3. 확인한 사실

구현 선택의 전제가 되는 도구 동작이다. 출처와 확인 날짜를 적는다.

| 항목 | 내용 | 출처 (확인일) |
|---|---|---|
| Electron 프로세스 | 메인 프로세스는 Node.js 환경이라 Node API를 모두 쓴다. 렌더러는 기본으로 Node API가 없다. preload는 렌더러에서 Node 접근을 가진 채 먼저 실행되고, context isolation(기본 켜짐) 아래에서 `contextBridge.exposeInMainWorld()`로 API를 내보낸다. utility process는 메인이 띄우는 Node 자식 프로세스다 | Electron 문서 `docs/tutorial/process-model.md` (2026-09-26) |
| 네이티브 모듈 | Electron은 Node와 ABI가 달라 네이티브 모듈을 Electron용으로 다시 빌드해야 한다. `@electron/rebuild`가 이를 한다 | Electron 문서 `docs/tutorial/using-native-node-modules.md` (2026-09-26) |
| node-pty 1.1.0 | `node-addon-api`(N-API) 기반이고, 패키지에 `win32-x64`, `win32-arm64`, `darwin-*` 사전 빌드(`pty.node`, `conpty.node`, `conpty.dll`, `OpenConsole.exe`)가 들어 있다. 설치 때 사전 빌드가 있으면 컴파일하지 않는다. 스레드 안전하지 않아 여러 worker thread에서 쓰지 말라고 한다. Windows는 1809 이상의 ConPTY를 쓴다 | npm 패키지 `node-pty@1.1.0` 내용, README (2026-09-26) |
| node-pty의 ConPTY 선택 | `useConptyDll`의 기본값은 `false`(Windows 내장 ConPTY)이고 타입 정의에 EXPERIMENTAL로 표시되어 있다. `true`면 네이티브 모듈 폴더 아래의 `conpty\conpty.dll`을 불러 쓰고, 이 DLL이 같은 폴더의 `OpenConsole.exe`를 띄운다. 프로세스가 끝났을 때는 `ClosePseudoConsole`을 부르지 않고 `kill()`에서만 부른다. 그래서 `taskkill`로 트리를 끝내면 내장 ConPTY에서는 `conhost.exe`가 남을 수 있다. DLL 모드는 시작 직후 `ConptyReleasePseudoConsole`을 불러, 연결된 클라이언트가 모두 끝나면 `OpenConsole.exe`가 스스로 끝난다 | npm 패키지 `node-pty@1.1.0`의 `typings/node-pty.d.ts`, `src/win/conpty.cc`, microsoft/terminal `winconpty.cpp` 주석 (2026-09-26) |
| electron-builder | `npmRebuild`의 기본값은 `true`이고, 패키징 전에 `@electron/rebuild`로 네이티브 모듈을 다시 빌드한다 | electron-builder `app-builder-lib/scheme.json` (2026-09-26) |
| Playwright의 Electron 지원 | 실험적 지원이다(`_electron`). `launch()`의 `executablePath`로 설치된 앱을 띄울 수 있다. `nodeCliInspect` 퓨즈가 꺼져 있으면 실행이 시간 초과될 수 있다. Electron 기본 대화상자(`dialog`)는 가로채지 못하므로 메인 프로세스에서 바꿔 끼워야 한다 | npm 패키지 `playwright-core@1.63.0` 타입 문서 (2026-09-26) |
| GitHub Actions 요금 | 공개 레포에서 표준 GitHub 호스트 러너는 무료다. 이 레포는 공개다 | GitHub 문서 billing/github-actions, 레포 정보 (2026-09-26) |
| 최신 버전 | electron 44.4.5, node-pty 1.1.0, @xterm/xterm 6.0.0, electron-builder 26.15.3, electron-vite 5.0.0, vitest 5.0.2 | npm 레지스트리 (2026-09-26) |
| Claude Code 동작 | 훅, 스킬, deny 규칙, 첫 실행 창, 강제 종료 뒤 재개는 `docs/spikes.md`의 S1~S6 결과를 따른다(2.1.283) | `docs/spikes.md` |
| 재개가 복원하는 것 | `--resume <세션 id>`는 대화(도구 호출과 결과 포함)를 복원한다. 끝나기 전에 끊긴 도구 호출은 결과를 모르는 것으로 표시된다. `--settings`, `--add-dir`로 준 것은 복원하지 않아 다시 줘야 하고, `bypassPermissions` 모드로 끝난 세션은 새 세션의 기본 모드로 열리므로 `--dangerously-skip-permissions`도 다시 준다. 저장된 대화가 없는 id면 "No conversation found with session ID"를 내고 끝난다 | Claude Code 문서 sessions, cli-reference (2026-09-26), S6 |
| 세션 전환 | `/clear`는 새 대화를 시작하고 이전 대화는 `/resume`으로 다시 연다. 대화형 `/resume`은 다른 대화로 옮기고, `/branch`는 가지(새 세션 id)로 옮긴다. `/clear`와 대화형 `/resume`은 앞 세션에 SessionEnd(`reason: clear`, `resume`)를 보낸다. 훅 본문의 `session_id`는 지금 세션이다. `/compact`는 같은 대화를 이어 간다 | Claude Code 문서 commands, hooks, sessions (2026-09-26) |
| 자동 메모리 | 기본으로 켜져 있다. 에이전트가 배운 것을 `<설정 폴더>/projects/<프로젝트>/memory/`에 적고 다음 세션 시작 때 읽는다. 프로젝트는 git 레포 단위라 worktree끼리 같은 폴더를 쓴다. `autoMemoryEnabled: false`는 어느 설정 파일(`--settings` 포함)에서도 읽힌다. 환경 변수 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`이 설정보다 우선한다 | Claude Code 문서 memory, settings-reference, env-vars (2026-09-26), S6 |
| HTTP 훅 머리글 | HTTP 훅에 `headers`를 줄 수 있다. 값에 `$VAR` 형태로 환경 변수를 넣을 수 있고, `allowedEnvVars`에 적은 변수만 풀린다. 응답 본문은 명령 훅과 같은 JSON 출력 형식이다. 기본 제한 시간은 600초(UserPromptSubmit은 30초)다 | Claude Code 문서 hooks (2026-09-26) |
| SessionEnd 훅 | 본문의 `reason`은 `clear`(`/clear`), `resume`, `logout`, `prompt_input_exit`, `other`다. `/clear`와 `/resume` 뒤에는 SessionStart(source `clear`, `resume`)로 새 세션이 시작된다 | Claude Code 문서 hooks (2026-09-26) |
| 훅 본문과 Stop 응답 | UserPromptSubmit은 `prompt`, Notification은 `message`와 `notification_type`, Stop은 `stop_hook_active`와 `last_assistant_message`를 보낸다. Stop을 막는 응답은 최상위 `{"decision":"block","reason":…}`이다. Stop 훅으로 연속 8번 이어 가면 Claude Code가 다음 막음을 무시하고 턴을 끝낸다(`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) | Claude Code 문서 hooks (2026-09-26) |
| 권한 규칙의 경로 | Read·Edit 규칙의 경로는 gitignore 패턴이다. 괄호는 이스케이프할 필요가 없다. "Yes, and don't ask again"으로 만든 규칙은 `[`, `]`, `*`를 이스케이프하지만 사람이 쓴 규칙은 이스케이프하지 않는다 | Claude Code 문서 permissions (2026-09-26) |
| `claude auth status` | 인증 상태를 JSON으로 보이고, 로그인되어 있으면 종료 코드 0, 아니면 1이다 | Claude Code 문서 cli-reference (2026-09-26) |
| 모델과 effort 환경 변수 | `ANTHROPIC_MODEL`은 별칭(`sonnet` 등)이나 모델 이름을 받는다. `CLAUDE_CODE_EFFORT_LEVEL`은 `low`~`max`, `auto`를 받고 `--effort`보다 우선한다. [실제] 시험은 앱이 넘기는 환경 변수로 모델과 effort를 정한다 | Claude Code 문서 model-config, env-vars (2026-09-26) |
| git ref 이름의 디렉터리/파일 충돌 | 기본 ref 저장 방식(`$GIT_DIR/refs` 디렉터리 트리)에서는 `refs/heads/foo`가 있으면 `refs/heads/foo/bar`를 만들 수 없다. reftable 형식은 둘을 받지만 git은 계속 거부할 수 있다. git 2.43.0에서 `relay/w-1`이 있을 때 `relay/w-1/discarded-1`을 만들면 "cannot lock ref … exists; cannot create"로 실패했다(D115) | git 문서 technical/reftable "Directory/file conflicts" (2026-09-27), 실행 |
| git worktree의 ref | `HEAD`와 `index`는 worktree마다 따로다. `refs/`로 시작하는 ref(브랜치)는 모든 worktree가 함께 쓴다. 그래서 worktree에서 `git reset`하면 그 worktree의 브랜치(`relay/<work-id>`)가 움직이고, 백업 브랜치는 레포 어디서나 보인다 | git 문서 git-worktree (2026-09-27) |
| `git reset --hard`와 `git clean` | `reset --hard`는 index와 작업 트리를 커밋에 맞추고, 그 커밋에 없는 추적 파일은 지운다. 추적하지 않는 파일은 지우지 않는다(겹치면 덮어쓸 수 있음). `git clean -d -f`는 추적하지 않는 파일과 폴더를 지우고, 무시하는 파일은 `-x`가 있어야 지운다 | git 문서 git-reset, git-clean (2026-09-27) |
| 진짜 index를 건드리지 않는 백업 커밋 | `GIT_INDEX_FILE`로 다른 index 파일을 쓸 수 있다. 그 index에 `git add -A`하고 `git write-tree`로 tree를 만들면 작업 트리의 상태(무시하는 파일 제외)가 담긴다. `git commit-tree <tree> -p <부모>`는 커밋 객체만 만든다. `git commit`과 달리 훅(pre-commit, commit-msg, post-commit)을 부르지 않는다. git 2.43.0 worktree에서 이 순서로 백업한 뒤 `reset --hard`와 `clean -fd`를 하면 진짜 index는 그대로였고, 무시하는 폴더는 남았다(D116) | git 문서 git(GIT_INDEX_FILE), git-add, git-write-tree, git-commit-tree, githooks (2026-09-27), 실행 |
| 커밋 수와 ref 찾기 | `git rev-list --count A..B`는 B에서 닿고 A에서 닿지 않는 커밋 수를 찍는다. `git for-each-ref`의 패턴은 fnmatch(3)로 맞춘다(`refs/heads/relay/<work-id>-discarded-*`) | git 문서 git-rev-list, git-for-each-ref (2026-09-27) |
| push와 upstream | `git push --set-upstream <원격> <ref>:<ref>`는 브랜치를 원격의 같은 이름으로 보내고 upstream(추적 브랜치)을 둔다. 원격의 브랜치는 fast-forward로만 바꾸고, 아니면 `--force`나 `+` 없이는 거부한다. git 2.43.0에서 push 뒤 원격 추적 브랜치(`refs/remotes/origin/<브랜치>`)도 바뀌었고, 같은 커밋을 다시 push하면 보낼 것 없이 성공했다 | git 문서 git-push (2026-09-27), 실행 |
| 원격 주소 | `git remote get-url <원격>`은 첫 fetch 주소를 찍고 `insteadOf`를 풀어서 찍는다. push 주소(`pushurl`)는 `--push`일 때 찍는다 | git 문서 git-remote (2026-09-27) |
| stash | `git stash push --include-untracked`는 커밋 안 된 변경과 추적하지 않는 파일을 stash 항목으로 저장하고, 작업 트리와 index를 HEAD로 되돌리고, 추적하지 않는 파일은 `git clean`으로 지운다. 무시하는 파일은 `--all`일 때만 넣는다. 최신 stash는 `refs/stash`다. `refs/`로 시작하는 ref는 모든 worktree가 함께 써서, git 2.43.0에서 worktree에서 만든 stash가 메인 체크아웃의 `git stash list`에 보였다 | git 문서 git-stash, git-worktree REFS (2026-09-27), 실행 |
| worktree 지우기 | `git worktree remove`는 깨끗한 worktree(추적하지 않는 파일과 추적 파일의 수정이 없음)만 지우고, 아니면 `--force`가 필요하다. 잠근 worktree(`git worktree lock`)는 `--force`를 두 번 줘야 한다. 메인 worktree는 지울 수 없다. `git worktree prune`은 폴더가 없어진 worktree의 관리 정보를 지운다. git 2.43.0에서 무시하는 파일만 있으면 `--force` 없이 지웠고(무시하는 파일도 함께 지워짐), worktree의 git 폴더에 `index.lock`이 남아 있어도 막지 않았다 | git 문서 git-worktree (2026-09-27), 실행 |
| 브랜치 지우기와 조상 | `git branch -D`는 `--delete --force`라 머지됐는지 보지 않고 지운다. 브랜치의 reflog도 지운다. git 2.43.0에서 worktree가 체크아웃한 브랜치는 지우지 않았다. `git merge-base --is-ancestor A B`는 A가 B의 조상이면 0, 아니면 1로 끝나고 그 밖의 종료 코드는 오류다 | git 문서 git-branch, git-merge-base (2026-09-27), 실행 |
| `gh pr create` | `--head`를 주면 브랜치를 push하지 않는다. `--base`, `--title`, `--body-file`(파일에서 본문), `--draft`를 받고, 만든 PR의 주소를 표준 출력에 찍는다. `--web`이 여는 비교 URL은 `<레포 주소>/compare/<base>...<head>?expand=1`이고 두 브랜치 이름은 경로 조각으로 인코딩한다(Go `url.PathEscape`, `/`는 `%2F`) | cli/cli `pkg/cmd/pr/create/create.go` (2026-09-27) |
| `gh pr list` | `--head <브랜치>`로 head 브랜치를 거른다(`<owner>:<branch>` 꼴은 받지 않음). `--state`의 기본은 `open`이다. `--json`은 고른 필드를 JSON 배열로 찍는다 | cli/cli `pkg/cmd/pr/list/list.go` (2026-09-27) |
| gh의 레포 고르기 | `--repo`는 `[HOST/]OWNER/REPO`나 URL을 받는다. URL로 읽는 것은 `git@`, `ssh:`, `git+ssh:`, `git:`, `http:`, `git+https:`, `https:`로 시작할 때뿐이고, 호스트는 소문자로 바꾸고 `www.`을 뗀다. `--repo`가 없으면 원격에서 고르는데, 기본 레포를 정하지 않았으면 원격 이름 upstream, github, origin 차례다. 원격 주소의 ssh 별칭(`~/.ssh/config`의 Host)은 원격에서 고를 때만 `ssh -G`로 푼다 | cli/cli `context/remote.go`, `pkg/cmd/factory/remote_resolver.go`, cli/go-gh `pkg/repository/repository.go`, `internal/git/url.go` (2026-09-27) |
| gh 환경 변수 | `GH_PROMPT_DISABLED`는 대화형 질문을 끄고, `GH_NO_UPDATE_NOTIFIER`는 새 버전 안내를 끈다 | `gh help environment`(cli/cli `pkg/cmd/root/help_topic.go`) (2026-09-27) |
| 폴더 신뢰와 훅 | 대화형 세션은 폴더 신뢰 창을 수락하기 전에는 모든 설정 파일의 훅을 실행하지 않는다. 앱이 `--settings`로 주는 훅도 같다(디버그 로그 "Skipping … hook execution - workspace trust not accepted"). `-p`와 SDK 세션은 신뢰한 것으로 본다. 레포에서는 신뢰를 레포 루트에 저장하고, worktree에서는 메인 체크아웃의 루트를 쓴다. 온보딩을 건너뛰는 `IS_DEMO`를 켜면 신뢰 창도 뜨지 않았고 훅이 오지 않았다(2.1.283) | Claude Code 문서 hooks(Workspace trust), permissions, env-vars (2026-09-26), M2 [실제] 준비 중 관찰 |
| `/proc`의 프로세스 정보 | `/proc/<pid>/stat`의 (2) comm은 괄호로 싼 실행 파일 이름이고 16바이트(끝의 NUL 포함)에서 잘린다. (3) state, (4) ppid가 있고, (22) starttime은 부팅 뒤 시작한 때를 클록 틱으로 적는다(`sysconf(_SC_CLK_TCK)`로 나눔). `/proc/stat`의 btime은 부팅 시각(유닉스 시각, 초)이다 | man-pages proc(5) (2026-09-27) |
| btime의 계산 | 커널은 btime을 읽을 때마다 벽시계와 부팅 뒤 시계의 차이(`getboottime64`)로 계산한다. 벽시계를 설정하면 그 차이가 바뀌어(`tk_set_wall_to_mono`) btime도 바뀐다 | Linux 소스 `fs/proc/stat.c`, `kernel/time/timekeeping.c` (2026-09-27) |
| Win32_Process의 부모와 시작 시각 | `ParentProcessId`는 만든 프로세스의 ID다. ID는 재사용되므로 끝난 프로세스나 ID를 재사용한 다른 프로세스를 가리킬 수 있고, `CreationDate`(실행을 시작한 때)로 부모가 먼저 만들어졌는지 가리라고 한다 | Microsoft 문서 Win32_Process(MicrosoftDocs/win32 `win32-process.md`) (2026-09-27) |
| Node의 프로세스 종료 | Windows에는 시그널이 없어 `SIGINT`, `SIGTERM`, `SIGKILL`을 보내면 대상 프로세스를 무조건 끝낸다. Linux에서는 부모를 끝내도 자식의 자식은 끝나지 않는다 | Node 문서 process(Signal events), child_process(`subprocess.kill`) (2026-09-27) |
| `detached` 자식 | Windows에서 `detached: true`로 띄운 자식은 부모가 끝나도 계속 돌고 자기 콘솔을 갖는다. 다른 OS에서는 새 프로세스 그룹과 세션의 리더가 되고, detached가 아니어도 부모가 끝난 뒤 계속 돌 수 있다 | Node 문서 child_process `options.detached` (2026-09-27) |
| Linux에서 앱이 죽은 뒤의 PTY | 앱 역할 프로세스를 SIGKILL로 끝내면 PTY 안의 프로세스는 보통 hangup으로 함께 끝난다. 그런데 node-pty 1.1.0의 master fd는 뒤에 띄운 자식에게 상속됐고(두 번째 PTY 세션의 프로세스가 첫 세션의 `/dev/ptmx`를 쥐고 있었음), master를 쥔 프로세스가 살아 있으면 PTY 안의 트리가 남았다 | 실행(Linux 컨테이너, node-pty 1.1.0) (2026-09-27) |
| worktree의 prune과 remove | `prune`은 작업 트리가 없어진 worktree의 `$GIT_DIR/worktrees` 정보를 지운다. `remove`는 깨끗한 worktree(추적하지 않는 파일과 추적 파일의 수정이 없음)만 지우고 아니면 `--force`가 필요하다. git 2.43.0에서 `.git` 파일이 없어진 worktree는 `--force`로도 지우지 않았고, prune은 관리 정보만 지우고 폴더는 남겼다. 지운 추적 파일도 수정으로 보아 `--force`가 있어야 지웠다 | git 문서 git-worktree, 실행 (2026-09-27) |
| stash 목록 | `git stash list`는 `git log`의 형식 옵션을 받는다. `--message`로 만든 항목의 제목(`%gs`)은 `On <브랜치>: <메시지>`였다(2.43.0) | git 문서 git-stash, 실행 (2026-09-27) |
| 없는 브랜치가 섞인 `git branch -D` | 있는 브랜치는 지우고 종료 코드 1로 끝났다(2.43.0) | 실행 (2026-09-27) |
| `TextDecoder`의 stream | `decode(input, { stream: true })`는 끝의 덜 끝난 바이트 열을 안에 두고 다음 호출 때 내보낸다. 한 번만 부르면 잘린 글자는 나오지 않는다 | Node 문서 util `textDecoder.decode` (2026-09-27) |

- N-API 사전 빌드가 Electron 44에서 다시 빌드 없이 로드되고, 설치 파일(asar)에서 `.node`와 `conpty\conpty.dll`, `OpenConsole.exe`가 풀려 나와 동작한다. M0의 [스모크]로 러너에서 확인했다(2026-09-26, `docs/checks.md`).
- Windows의 Node(libuv)는 stdin을 raw 모드로 읽고 있을 때만 콘솔 크기 변경을 알아챈다(libuv `docs/src/signal.rst`). 가짜 `claude`도 stdin을 raw 모드로 읽어야 크기 변경 시험이 맞다(app-ci #1~#5).
- node-pty의 `kill()`은 내장 ConPTY에서 보조 프로세스(`conpty_console_list_agent`)가 "AttachConsole failed"로 죽는 일이 러너에서 다시 보였다. 앱은 `taskkill`로 트리를 끝낸다(6절).
- DLL 모드(I32)로 실제 `claude`가 동작하는지는 아직 확인하지 않았다. 스파이크는 내장 ConPTY로 돌렸다. M0의 [실기]는 생략했으므로 다음 실기 때 확인한다.
- Linux에서 트리 종료(node-pty `kill()`, SIGHUP)를 받은 `claude`는 SessionEnd 훅(`reason: other`)을 보내고 응답을 기다린 뒤 끝났다(응답을 5초 늦추면 5.4초 뒤에 끝남, 2.1.283). SessionEnd 훅은 기본 1.5초까지 기다리고, 훅에 `timeout`을 주면 가장 큰 값(최대 60초)까지 기다린다(Claude Code 문서 hooks). 앱은 훅마다 `timeout` 30초를 주고, Work의 처리 줄 안에서 종료를 기다리며 훅 응답도 같은 줄에서 만든다. 그래서 응답이 종료 대기 시간(10초)만큼 늦어져 M2 [실제](Linux)에서 task 사이마다 10초가 걸렸다. Windows(`taskkill /F`)에서 같은 지연이 있는지는 Windows [실제]나 [실기]에서 본다. Linux는 시험 환경뿐이라 M3에서 고치지 않기로 했다(사용자 결정). [즉시 중단], 앱 종료, 승인 뒤 다음 task와 대기열 시작도 Linux에서는 이만큼 늦다.
- 스파이크 S6(I31)는 레포에 Claude 인증 secret이 없어 러너 대신 Claude Code 웹 세션의 Linux 컨테이너에서 예비 확인으로 돌렸다(2026-09-26). Linux에는 `taskkill`이 없어 강제 종료는 프로세스 그룹 SIGKILL로 흉내 냈다. 결과는 통과이고, Windows(`taskkill /T /F`)에서도 같은지는 [실기]에서 본다(`docs/spikes.md` S6).
- S6에서 Linux의 프로세스 그룹 SIGKILL은 claude가 Bash 도구로 띄운 셸과 명령을 남겼다(claude가 이들을 다른 프로세스 그룹으로 띄움). 앱은 Linux에서 node-pty `kill()`(SIGHUP)을 그대로 쓴다.

## 4. 기술 선택

| 영역 | 선택 | 결정 |
|---|---|---|
| 언어 | TypeScript, `strict: true` | I1 |
| 프로세스 | 메인: PTY, 훅 서버, 저장소, git, 파일 감시. preload: `contextBridge`로 API 노출(context isolation 켬, 렌더러 Node 통합 끔). 렌더러: 화면 | I2 |
| 빌드 | electron-vite(메인·preload·렌더러 세 번들) | I3 |
| 화면 | React, `@xterm/xterm`. 컴포넌트 라이브러리 없음 **(기본값)** | I4 |
| 단위 테스트 | Vitest | I5 |
| 패키지 관리 | npm, lockfile 커밋 | I6 |
| 레포 배치 | `app/` 독립 패키지. `skills/` 원본은 빌드 때 앱 리소스로 넣음 | I7 |
| 배포 | electron-builder NSIS, x64, 사용자별 설치, 서명·자동 업데이트 없음. 수동 워크플로로 러너에서 빌드 | I8 |

- **버전:** 시작할 때의 안정 버전을 정확한 버전으로 고정한다 **(기본값)**. Electron을 올리면 node-pty 로드와 설치 파일 시험(3절의 확인 필요 항목)을 다시 한다.
- **YAML과 스키마 검사:** `skills/check.mjs`와 같은 `yaml`, `ajv`(draft 2020-12)를 쓴다. 검사 코드는 앱에서 따로 쓴다(I18).

## 5. 모듈 구조

### 5.1 배치 (I9)

```
app/src/
  shared/    work.json·project.json·config.json 타입, IPC 메시지 타입
  core/      순수 로직. Node와 Electron API를 쓰지 않는다
  adapters/  바깥 세계와 닿는 코드
  main/      조립. 앱 수명주기, 흐름 실행, IPC 처리
  preload/   contextBridge API
  renderer/  React 화면
```

### 5.2 모듈과 맡는 일

| 층 | 모듈 | 맡는 일 | 설계 |
|---|---|---|---|
| core | `pipeline` | 노드 순서, S 빠른 경로, 선택 가능한 다음 단계, 기본 다음 단계 | 3.1, 3.2, 3.4 |
| core | `machine` | Work와 Task 상태 전이. `(상태, 이벤트) → (새 상태, 할 일)` (I10) | 3.3, 시나리오 3~5 |
| core | `validate` | handoff와 intent 초안의 머리글 파싱, 스키마 검사, 추가 검사, 되돌림 메시지 | 5.2.1, D107 |
| core | `context` | `context.md` 조립(입력: 상태, intent, 결정 로그, 누적 기각 목록, 직전 handoff), 마무리 안내 문구(D104) | 시나리오 2-4 |
| core | `settings` | task 설정 파일 내용(훅, deny 규칙) 만들기, 실행 인자 만들기 | 시나리오 2-3·2-5, 6절 |
| core | `approval` | 자동 승인 조건 판정, 배지 우선순위 | 4.3, D80 |
| core | `rewind` | 단계 선택의 결과 계산(폐기할 task, 되돌릴 커밋, 건너뛸 단계, 백업 브랜치 이름), 대화상자의 단계와 미리 보기 | 6.2, 6.3, D82, D115~D117 |
| core | `delivery` | 전달 버튼과 그 이유, 전달을 시작할 수 있는지, `pr.md`의 제목과 본문, 비교 URL과 gh의 레포, 커밋 안 된 변경의 커밋·stash 메시지 | 시나리오 7, D62, D67, D71, D118~D120 |
| core | `cleanup` | 정리할 수 있는 Work, 확인 요약과 기본 선택, 지울 브랜치와 `--force` | 시나리오 8, D16 |
| adapters | `store` | RELAY_HOME 경로, 원자적 쓰기, 앱 소유 파일 해시, `events.jsonl`, `decisions.md` | 5.1, 5.4, 5.5, D91 |
| adapters | `pty` | node-pty 세션, `pty.log` 기록, 프로세스 트리 종료, 프로세스 ID와 시작 시각 | S1, D76 |
| adapters | `hooks` | 훅 HTTP 서버, 토큰 확인, Stop 응답 (I13) | S2, D20, D21 |
| adapters | `git`, `gh` | worktree, status, diff, reset, 백업 브랜치, push, stash, 커밋, worktree와 브랜치 지우기, `gh auth status`, `gh pr` (I12) | 시나리오 1·6·7·8 |
| adapters | `watch` | task 디렉터리 감시 (I15) | 시나리오 3-3 |
| adapters | `claude` | 실행 파일 찾기(D106), `claude auth status`, 버전 기록(D105), 이번 task의 스킬 배포(D103, D108) | 시나리오 0, 2-2, 5.6.3 |
| main | `app` | 시작 때 재시작 조정(시나리오 9), 종료 확인 | 시나리오 3-6, 9 |
| main | `runner` | 할 일 실행: task 시작·종료, 세션 상한 대기열, 되감기, 전달과 정리 세션, 정리 | 시나리오 2, 5~8, D18 |
| main | `ipc` | 렌더러 명령 처리, 스냅샷 전송 (I14) | |
| renderer | 화면 | 사이드바, 터미널 탭과 머리 띠, 액션 바, 오른쪽 패널(승인 화면), 대화상자 | 화면 구성 |

### 5.3 흐름

- 훅 신호, 사람 버튼, 타이머(카운트다운), 프로세스 종료는 모두 이벤트로 바뀌어 `machine`을 지난다. `main`은 돌려받은 할 일을 차례로 실행하고, 전이마다 `work.json`을 쓴다(I11).
- 렌더러는 명령만 보내고 상태는 메인이 보낸 스냅샷으로 그린다(I14).

## 6. 스파이크 코드 재사용

앱은 새로 쓰고, 아래 세부만 옮긴다(I16). 옮긴 코드에는 출처 파일을 주석으로 남긴다.

| 옮길 것 | 출처 | 앱 모듈 |
|---|---|---|
| `claude` 실행 파일 찾기(`CLAUDE_BIN`, `%USERPROFILE%\.local\bin\claude.exe`, npm `claude.cmd`, PATH. D106) | `spikes/lib/session.mjs` `resolveClaude` | `adapters/claude` |
| npm `.cmd`를 `cmd.exe /d /s /c`로 감싸 실행, `useConpty: true`, `xterm-256color`. 앱은 `useConptyDll: true`를 더한다(I32) | `spikes/lib/session.mjs` `start` | `adapters/pty` |
| 프로세스 트리 종료 `taskkill /PID <pid> /T /F`(node-pty `kill()` 대신) | `spikes/lib/session.mjs` `kill`, `util.mjs` `killTree` | `adapters/pty` |
| 프로세스 ID와 시작 시각 조회(I20) | `spikes/lib/util.mjs` `processes`, `isAlive` | `adapters/pty` |
| deny 규칙의 절대 경로 변환(`C:\x` → `//c/x`) | `spikes/lib/util.mjs` `ruleAbs` | `core/settings` |
| 훅 설정 모양(이벤트별 `matcher`, `type: http`) | `spikes/lib/hooks.mjs` `settings` | `core/settings` |
| Stop 되돌림 응답 `{"decision":"block","reason":…}` | `spikes/lib/hooks.mjs` | `adapters/hooks` |
| 파일 해시(SHA-256) | `spikes/lib/util.mjs` `sha256` | `adapters/store` |
| 고아 프로세스의 트리 모으기(부모 ID)와 Linux 프로세스 목록(`/proc`) | `spikes/lib/util.mjs` `descendants`, `procList` | `adapters/pty` |

시험 도구로만 옮기는 것(I17): xterm headless 화면 읽기, 첫 실행 창 자동 수락(`handleDialogs`), 입력 대기 판정(`waitReady`), 테스트용 레포와 bare 원격 만들기(`makeFixture`), 결과 기록(`Result`), 앱 역할 프로세스(`orphan-parent.mjs` → `test/fixtures/app-role.mjs`).

새로 쓰는 것: 상태 기계, 저장소, `context.md` 조립, 형식 검사(I18), 되감기, 전달, 정리, 화면.

## 7. 마일스톤

- 순서는 M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7이다(I21, I23).
- 첫 목표인 최소 흐름은 M2다(I22).
- M3가 끝나면 실제 버그에 쓰기 시작하고, 쓰면서 나온 불편으로 M4~M7의 순서를 다시 정한다(I24).
- 완료 기준 앞의 꼬리표는 확인 방법이다: [단위], [어댑터], [흐름], [스모크], [실제], [실기]. 뜻은 8.1을 따른다. [실제]와 [실기]의 결과는 `docs/checks.md`에 기록한다(I30).

| # | 이름 | 한 줄 요약 | 선행 |
|---|---|---|---|
| M0 | 골격과 배포 | 설치한 앱의 탭에서 PTY로 `claude`가 뜬다 | |
| M1 | core | 설계의 표를 옮긴 순수 로직과 단위 시험 | |
| M2 | 최소 흐름 | Work 하나가 intake부터 Work 완료까지 간다 | |
| M3 | 사람 조작과 여러 Work | 중단·재개, 대기열, 배지, 알림, 설정, 재시작 기본 처리 | 스파이크 S6(I31) |
| M4 | 되감기와 단계 선택 | 6.2의 되감기 규칙과 단계 선택 대화상자 | |
| M5 | 전달과 정리 | push, PR, 커밋 안 된 변경 처리, Work 정리 | |
| M6 | 복구 | 고아 프로세스, 끊긴 작업 알림, 해시 경고 | |
| M7 | 자동 승인 | 조건 판정과 카운트다운 | |

### M0. 골격과 배포

**내용**

- `app/` 패키지: electron-vite, TypeScript strict, React, Vitest 설정(I1~I7).
- 3단 레이아웃의 빈 화면(D79).
- 탭 하나에서 node-pty(DLL 모드, I32)로 `claude`를 실행하고 xterm.js에 붙인다. 창 크기 변경을 PTY에 전달한다. 탭을 닫으면 프로세스 트리를 종료한다.
- electron-builder NSIS 설정과 수동 워크플로. Windows 러너에서 설치 파일을 만들어 결과물로 올린다(I8).

**완료 기준**

- [스모크] 러너에서 만든 설치 파일로 설치한 앱이 뜨고, 탭에서 PTY로 띄운 가짜 `claude`의 출력이 보인다. 3절의 확인 필요 항목(N-API 사전 빌드 로드, asar 밖의 `conpty.dll`과 `OpenConsole.exe`)이 이것으로 확인된다.
- [어댑터] PTY 세션을 트리 종료하면 남는 프로세스가 없다. `OpenConsole.exe`도 남지 않는다(I32).
- [실기] 설치한 앱의 탭에서 실제 `claude`가 동작한다. 한글 IME 조합 입력이 일반 터미널과 같다. 스파이크 S1에서 남은 항목이다.
- [실기] DLL 모드(I32)에서 스파이크 S1의 확인 항목(화면 표시, 한글 문자열, 백스페이스, 창 크기 변경)이 내장 ConPTY 때와 같다.

### M1. core

**내용**

- `shared` 타입(I19), `core/pipeline`, `core/machine`, `core/validate`, `core/context`, `core/settings`.
- `machine`은 기본 흐름만 담는다: task 시작, 실행 중 표시(작업 중, 질문 대기, 대기, 승인 대기, 막힘, 세션 종료), 승인, 다음 task 결정, 이전 단계 추천에서 멈춤, 형식 오류 되돌림 횟수(D21, D107), Work 완료. 중단, 재개, 대기열, 되감기, 자동 승인의 전이는 해당 마일스톤에서 더한다.

**완료 기준** (모두 [단위])

- 선택 가능한 다음 단계(3.2): M 경로와 S 경로의 노드마다 기본 다음 단계와 이전 단계 목록이 맞다.
- 시나리오 3의 신호 표: 신호마다 표시 상태가 맞다.
- 형식 검사(5.2.1): 검사 항목마다 통과 예와 실패 예가 있다. 되돌림 메시지에 필드와 어긴 규칙이 들어 있다. 경고(D85, 분량 기준)는 오류로 치지 않는다.
- `_common.md`와 `work-start`의 템플릿 예시가 앱 검사기를 통과한다(I18, D87).
- `context.md`에 시나리오 2-4 표의 항목과 마무리 안내 문구(D104)가 들어간다. 되감기 항목은 M4에서 더한다.
- task 설정 파일에 훅 여섯 가지(I13의 형식)와 deny 규칙(D17, 시나리오 2-3)이 들어간다.

### M2. 최소 흐름

**내용**

- 저장소(5.1): `RELAY_HOME`, `config.json` 기본값, `project.json`, `work.json`(원자적 쓰기), `request.md`, `intent.md`와 `intent.history/`, `decisions.md`, `events.jsonl`.
- 프로젝트 등록(시나리오 0): `claude` 찾기(D106), 점검 표(D67), 기본 브랜치.
- Work 생성(시나리오 1): work-id, 브랜치와 worktree(`core.longpaths`), 기준 커밋(D97), 로컬·원격 기준 위치.
- task 시작(시나리오 2): task 디렉터리와 시작 커밋, 스킬 배포(5.6.3, D103, D108), task 설정 파일, `context.md`, PTY 실행, Claude Code 버전 기록(D105), 머리 띠(D109).
- 훅 서버(I13), 신호별 표시(시나리오 3), `permission_mode` 경고(D94).
- handoff와 intent 초안 감시와 검사(I15), Stop 되돌림(D21, D107).
- 승인 화면(D83): 강조 영역, [요약]·[산출물]·[변경] 탭, [오류 무시하고 승인](4.1, D90).
- 의도 승인(4.1): `intent.md` 확정, `size` 고치기.
- 승인 뒤(시나리오 4-4, 5): 세션 트리 종료, `pty.log` 저장, `decisions.md` 추가, 다음 task 자동 시작(S 경로 포함).
- 이전 단계 추천(D23): 멈추고 알리기만 한다. 단계 선택은 M4에서 넣는다.
- Work 완료 화면(시나리오 7-3): 판정표, 전체 변경, [완료만].
- 넣지 않는 것: 여러 Work(한 번에 하나), 중단과 재개, 대기열, push와 PR, 자동 승인, 재시작 처리.

**완료 기준**

- [흐름] 가짜 `claude`로 M 경로(intake → evidence → rca → fix → verify → [완료만])와 S 경로(intake → fix → verify → [완료만])가 끝까지 간다.
- [흐름] 형식 오류를 되돌리면 고쳐 쓴 handoff로 승인 대기가 된다. 되돌림은 설정 횟수까지만 한다.
- [흐름] `work.json`, `intent.md`, `decisions.md`, `events.jsonl`이 설계(5.1~5.5)의 모양대로 남는다.
- [어댑터] 프로젝트 등록 점검(D67), worktree와 기준 커밋, 원격 기준 위치의 fetch 실패 처리가 맞다.
- [스모크] 가짜 `claude`로 intake task 하나를 [의도 승인]까지 누른다.
- [실제] 실제 `claude`로 M 경로와 S 경로가 끝까지 간다. task마다 되돌림 횟수를 기록한다.
- [실기] 사람이 작은 버그 하나를 Work 생성부터 Work 완료까지 진행한다.

### M3. 사람 조작과 여러 Work

**내용**

- 중단과 재개: [즉시 중단], [재개](`--resume`, 이전 화면 먼저 보이기), handoff 없이 끝난 세션의 [세션 재개]·[이 단계 새 세션으로 다시], [이 단계 끝나면 멈춤], 세션 없는 막힘의 [세션 재개]·[Work 포기](4.4), [Work 포기].
- 여러 Work: 세션 상한과 대기열(D18), 사이드바 배지(D80), OS 알림(D81).
- 끝난 task 탭을 `pty.log`로 읽기 전용 표시.
- 설정 화면(D70, D73), Work별 질문 방식(D72).
- 앱 종료 확인(시나리오 3-6). 재시작 때 "실행 중"인 task는 "중단됨"으로(유효한 handoff가 있으면 "승인 대기"로), 대기열의 task는 "중단됨"으로 바꾼다(D75, D78).

**완료 기준**

- [흐름] Work 둘 이상을 나란히 돌리고, 상한을 넘은 task가 대기열에서 자동으로 시작된다.
- [흐름] [즉시 중단] 뒤 [재개]가 같은 세션 id로 `--resume`을 부른다. 재시작 조정(D75, D78)이 `work.json`을 맞게 바꾼다.
- [실제] 트리 종료한 세션을 `--resume`으로 다시 열면 대화가 이어진다.
- [실기] 사람이 필요한 상태가 되었는데 그 Work를 보고 있지 않으면 OS 알림이 온다. 배지, 읽기 전용 탭, 설정 화면이 설계대로 보인다. 앱을 껐다 켜서 재개한다.

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. 설계를 바꾼 것은 D113, D114다)

- **[즉시 중단]과 앱 종료:** 세션을 트리째 끝낸다. 유효한 handoff로 승인 대기나 막힘이던 task는 세션이 없어도 그 표시로 남고(3.3) 승인할 수 있다. 그 밖에는 중단됨이다. 대기열의 task는 대기열에서 빼고 중단됨으로 둔다.
- **[재개]와 [세션 재개]:** 세션이 있던 task는 같은 옵션에서 `--session-id`와 첫 프롬프트를 빼고 `--resume <세션 id>`를 붙여 다시 연다(S6). 설정 파일은 다시 쓴다(훅 서버의 포트와 토큰이 바뀔 수 있음, I13). 한 번도 띄우지 못한 task(시작 실패, 대기열에 있다가 재시작을 맞음)는 새 세션으로 시작한다. 다시 연 뒤의 표시는 그때의 형식 검사로 정한다: 유효한 handoff면 승인 대기나 막힘, 아니면 대기. 탭에는 이전 화면 뒤에 "relay: 세션 재개" 줄과 새 출력을 잇고, 이 줄은 `pty.log`에도 쓴다. 머리 띠는 "세션 재개"다. 다시 여는 세션은 지금 대화다: 사람이 탭에서 `/clear`, 대화형 `/resume`, `/branch`로 다른 대화로 옮기면(D110) 턴 안의 훅(UserPromptSubmit, PreToolUse, PostToolUse, Stop)이 가져온 `session_id`로 task의 세션 id를 바꾼다. 알림과 SessionEnd로는 바꾸지 않는다: `/clear` 직후처럼 대화가 없는 세션은 `--resume`으로 열 수 없다(S6). 서브에이전트 안의 훅(`agent_id`가 있음)으로도 바꾸지 않는다. 바꾼 id는 `work.json`에 두고, 5.5에 없는 이벤트 유형은 더하지 않는다(`task.resumed`의 `session_id`에 드러남).
- **대기열(D18):** 모든 Work가 대기열 하나를 쓰고 먼저 들어온 차례로 시작한다. 새 task, [재개], [세션 재개], [이 단계 새 세션으로 다시]가 모두 세션 상한을 따른다. 승인으로 자리가 나면 먼저 기다리던 task가 시작하고, 승인한 Work의 다음 task는 대기열 뒤에 선다.
- **멈춘 Work의 [재개](3.3):** 멈추게 한 task의 기본 다음 단계를 시작한다. 이전 단계 추천(D23)으로 멈췄으면 추천을 따르지 않고 기본 다음 단계로 간다(추천대로 되돌아가는 것은 M4의 단계 선택). verify에서 멈췄으면 Work를 완료한다. [이 단계 끝나면 멈춤]은 verify 승인에도 적용된다: [완료만]을 눌러도 Work를 완료하지 않고 멈추며, [재개]하면 완료한다. 패널에는 [재개]가 할 일(다음 단계 이름이나 Work 완료)을 보인다. M5부터 verify에서 멈춘 Work는 [재개] 대신 Work 완료 화면에서 전달을 고르고, [완료만]이 이 완료를 맡는다(D119).
- **[Work 포기]:** 살아 있거나 대기열에 있는 task는 승인 대기였어도 중단됨이다. 포기한 Work에는 승인, 재개 같은 명령을 받지 않는다.
- **알림(D81):** 배지가 사람이 필요한 다섯 상태(D80)로 바뀔 때와 대기열에서 자동으로 시작할 때 보낸다. 창에 포커스가 있고 최소화되지 않았고 그 Work를 고른 상태면 보내지 않는다. 알림을 누르면 창을 띄워 그 Work를 고른다. 재시작 조정으로 바뀐 상태는 알리지 않는다.
- **설정 화면(D70):** 세션 상한(1~20), 스킬별 질문 방식, 형식 오류 되돌림 횟수(0~8. Stop 훅으로 연속 8번 이어 가면 Claude Code가 막음을 무시함, 3절), 분량 경고 기준, draft PR을 바꾼다. 자동 승인과 카운트다운은 M7에서 연다. `config.json`의 값이 틀리면 그 키는 기본값을 쓰고 경고한다. Work별 질문 방식(D72)은 새 Work 대화상자와 [Work 설정]에서 고른다.
- **앱 종료 확인(시나리오 3-6):** 창을 닫을 때와 앱을 끝낼 때 살아 있는 세션이 있으면 묻는다. 대기열의 task는 다음 실행 때 중단됨이 된다(D78).
- **재시작 조정(D75, D78):** "실행 중"은 세션이 살아 있던 task와 세션을 띄우는 중이던 task다. 바뀐 task는 `events.jsonl`에 `task.interrupted`나 `task.awaiting_approval`로 남긴다(`payload.reason: app_restart`).

### M4. 되감기와 단계 선택

**내용**

- 단계 선택 대화상자와 미리 보기(D82), 되감기 규칙(6.2)과 제약(6.3), 폐기 표시.
- 코드 되돌리기와 백업 브랜치, [현재 코드 위에서 이어서].
- intake 되감기와 intent 새 버전(D40).
- `context.md`의 폐기된 시도 요약과 추가 지시.
- 이전 단계 추천과 막힘에서 단계 선택으로 잇기.
- 진행 중 작업 기록(D77). 재시작 때의 알림은 M6에서 넣는다.

**완료 기준**

- [단위] 6.2 표의 네 경우와 미리 보기(D82)의 계산이 맞다.
- [흐름] verify에서 fix로 되감아 다시 Work 완료까지 간다. 되돌린 커밋이 백업 브랜치에 남는다.
- [흐름] intake로 되감으면 intent 버전이 오르고, 모든 산출물이 폐기된다.
- [실기] 단계 선택 대화상자의 미리 보기가 실제 결과와 같다.

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. 설계를 바꾼 것은 D115~D117이다)

- **단계 선택을 받는 Work:** 진행 중이거나 멈춘 Work다. 완료와 포기한 Work는 끝났다(3.3). 승인된 intent가 없으면 intake만 고른다(6.3). intake로 되감은 뒤 새 intake를 승인하기 전에는 승인된 intent가 있어 다른 단계도 고를 수 있다. 뒤 단계를 고르면 새 intake를 폐기하고 지금 intent로 간다.
- **k 진행 중과 k 완료(6.2):** 진행 중인 Work의 지금 task는 늘 진행 중이다. k 완료는 k를 승인하고 Work가 멈춘 경우다([이 단계 끝나면 멈춤], 이전 단계 추천).
- **폐기:** 되감기는 고른 단계 이후 노드의 task 가운데 폐기되지 않은 것을 모두 폐기한다. 새 세션으로 다시 한 앞 task(D114)도 들어간다. 건너뛰기는 진행 중인 k만 폐기한다. 폐기한 task는 폐기됨으로 두고, 폐기한 때와 폐기를 부른 새 task를 `work.json`에 남긴다. 입력(결정 로그의 항목, 기각 목록, 직전 handoff, 산출물)에서 빠지고, 파일과 `decisions.md`는 그대로다. deny 규칙은 이전 task 디렉터리를 모두 막는다(폐기된 것과 세션 종료로 남은 것 포함).
- **새 task의 이유:** 되감기는 "되감기", 건너뛰기는 "건너뛰기"다. 끝난 k의 기본 다음 단계를 고르면 건너뛴 것도 폐기한 것도 없어 "기본 진행"이고 추가 지시만 남는다.
- **`context.md`의 맨 위 절(시나리오 2-4):** 되감기는 "되감기로 들어옴 (먼저 읽을 것)"에 사람 추가 지시, 폐기된 시도 요약, 코드를 넣는다. 폐기된 시도 요약은 이번에 폐기한 task마다 handoff의 `## 요약`, rejected, 이전 단계 추천이다. handoff가 없으면 없다고 적는다. 건너뛰기는 "건너뛰어 들어옴 (먼저 읽을 것)"에 건너뛴 단계, 폐기한 task, 사람 추가 지시를 넣는다. 기본 진행은 추가 지시가 있을 때만 "사람 추가 지시 (먼저 읽을 것)"를 넣는다. 백업 브랜치 이름은 넣지 않는다(폐기는 입력에서 빼는 것).
- **백업 브랜치 번호(D115):** git에 있는 이 Work의 백업 브랜치 가운데 가장 큰 번호 + 1이다. 실패로 남은 백업 브랜치와도 겹치지 않는다.
- **되돌리기와 백업(D116, D117):** 되돌릴 커밋이나 커밋 안 된 변경이 있을 때만 백업 브랜치를 만든다. 커밋 안 된 변경은 진짜 index를 건드리지 않고 커밋 하나(`relay(<work-id>): 되감기 전 커밋 안 된 변경`)로 HEAD 위에 담는다(3절). 그 뒤 `git reset --hard`로 되돌리고, 변경이 있었으면 `git clean -d -f`로 추적하지 않는 파일을 지운다. 무시하는 파일(설치한 의존성 등)은 남는다. 폐기하는 task가 한 번도 시작하지 않았으면(대기열) 되돌릴 커밋이 없어 코드를 건드리지 않는다. [현재 코드 위에서 이어서]로 시작한 fix를 다시 되감으면 그 fix의 시작 커밋(이어받은 커밋 포함)으로 되돌린다.
- **진행 중 작업 기록(D77):** 코드를 되돌리는 되감기만 기록한다. 세션을 끝내며 `operation`(kind `rewind`, stage `backup`)을 적고, 백업 브랜치를 만들면 stage를 `reset`으로 바꾸고, 되돌린 뒤 폐기와 새 task를 쓰는 `work.json` 한 번 쓰기에서 지운다. 코드를 건드리지 않는 선택(건너뛰기, [현재 코드 위에서 이어서])은 `work.json` 한 번 쓰기로 끝나 끊길 곳이 없어 기록하지 않는다. git이 실패하면 [단계 선택]의 결과와 Work의 문제로 알리고 기록을 지운다. 끝낸 세션은 끝난 채로 두고(승인 대기였으면 승인 대기로 남아 승인할 수 있음), 만든 백업 브랜치는 남는다. 재시작 때 남은 기록은 그대로 둔다(알림은 M6).
- **이벤트(5.5):** 되감기는 `task.rewound`, 건너뛰기는 `task.skipped_to`를 새 task의 이벤트로 남긴다. payload는 고른 단계(`node`), 단계를 고른 때의 task(`from_task`), 폐기한 task(`discarded`)이고, 되감기는 `keep_code`와 되돌렸으면 `reset_to`, `backup_branch`, 건너뛰기는 `skipped`를 더한다. 끝낸 k는 `task.interrupted`(`reason: rewind`나 `skip`)다. 5.5에 없는 유형은 더하지 않았다.
- **미리 보기와 [확인](D82):** 미리 보기는 core의 계산에 git(되돌릴 커밋 수, 커밋 안 된 변경)과 산출물 파일을 더한다. 대화상자는 Work가 바뀔 때마다 미리 보기를 다시 읽는다. [현재 코드 위에서 이어서]는 fix로 되감을 때만 보인다(건너뛰어 fix로 가면 되돌릴 것이 없다). [확인]은 미리 본 때의 지금 task와 그 task가 끝났는지를 함께 보내고, 그 사이 바뀌었으면 받지 않는다.
- **끝난 task의 [변경](D83):** [변경] 탭은 이 task의 diff다. task의 시작 커밋부터 코드가 다음에 바뀐 때까지 본다. 다음에 시작한 task가 있으면 그 시작 커밋까지다. 코드를 되돌린 되감기가 먼저 오면 백업 커밋(커밋 안 된 변경 포함)까지이고, 백업하지 않았으면 되돌리기 전 HEAD까지다. 백업 커밋은 새 task의 선택 기록(`reset.backup_commit`)에 남긴다. 그래서 폐기된 fix의 탭은 백업 브랜치에 남은 원래 수정을 보인다. 작업 트리와 비교하는 것은 지금 코드의 마지막 task뿐이고, 커밋 안 된 변경의 강조도 이 task에만 보인다. verify의 전체 변경도 같은 끝까지다. 전에는 끝난 task도 지금 작업 트리와 비교해, 되감은 뒤 폐기된 fix의 변경이 비거나 새 시도의 변경이 보였다(리뷰에서 찾음).
- **[단계 선택]을 여는 곳:** 액션 바와 멈춘 Work의 패널 안내다. 이전 단계 추천으로 멈췄으면 추천한 단계를 먼저 고른다(D23). 세션 없는 막힘(4.4)의 안내에도 [단계 선택]을 적었다. 멈춘 Work의 [재개]는 M3 그대로 추천을 따르지 않고, 안내가 [단계 선택]을 가리킨다.
- **세션 상한(D18):** 새 task는 새 task 시작과 같은 길로 상한을 따른다. 끝낸 k의 자리는 먼저 기다리던 task가 받는다(M3의 승인과 같음).
- **[이 단계 끝나면 멈춤]:** 단계 선택으로 꺼지지 않는다. 켜져 있으면 새 task가 승인될 때 멈춘다.
- **Linux의 10초:** 살아 있는 세션을 끝내는 단계 선택은 [즉시 중단]처럼 Linux에서 10초 늦다(3절).

### M5. 전달과 정리

**내용**

- push와 비교 URL, PR(`pr.md`의 제목과 본문, draft 설정 D71, 이미 열린 PR), 전달 버튼 비활성화(D67). verify의 마무리 안내 문구에 `[push]`와 `[PR 생성]`을 더한다(D104).
- 커밋 안 된 변경의 세 선택지(시나리오 7-5), 실패 때 [다시 시도]·[전달 없이 완료].
- Work 정리(시나리오 8).
- 진행 중 작업 기록(D77).

**완료 기준**

- [흐름] 로컬 bare 원격으로 push된다. 가짜 `gh`가 `pr.md`의 제목과 본문, draft 설정으로 불린다 **(기본값: 가짜 `gh`도 가짜 `claude`처럼 둔다)**.
- [흐름] 커밋 안 된 변경의 세 선택지가 각각 끝까지 간다.
- [흐름] 정리 뒤 worktree는 없고 산출물은 남는다.
- [실기] 시험용 GitHub 레포에 실제 PR을 만든다.

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. 설계를 바꾼 것은 D118~D120이다)

- **전달을 시작하는 때:** 진행 중인 Work의 verify가 턴을 끝냈고(승인 대기, 대기, 세션 종료) 형식 오류 없이 승인할 수 있을 때와, verify에서 멈춘 Work(D119)다. 승인하면 멈추는 verify는 [승인하고 멈춤]만 받는다. verify의 [오류 무시하고 승인]은 [완료만]처럼 전달 없이 완료하고, 멈추는 verify면 멈춘다. verify에서 멈춘 Work는 이미 승인됐으므로 형식 검사 없이 전달을 받는다. 이때 `pr.md`의 첫 줄이 `# <PR 제목>`이 아니면 [PR 생성]은 PR 단계에서 실패한다.
- **세션과 승인 기록(D120):** [push]·[PR 생성]을 누르면 verify 세션을 끝내고(유효한 handoff라 승인 대기로 남음) 전달한다. 성공하면 `work.json` 한 번 쓰기로 verify 승인(`task.approved`, `decisions.md`), 전달 결과, Work 완료를 남기고 진행 중 작업 기록을 지운다. 실패하면 `delivery.failed`에 실패한 단계와 오류를 남긴다. verify는 승인 대기로 남아 [세션 재개]로 다시 열 수 있다. [다시 시도]는 같은 전달을 처음부터 다시 한다(이미 push한 커밋은 다시 보내지 않음, 3절). 앞 시도가 커밋 안 된 변경을 처리하며 만든 stash와 커밋은 결과에 이어 남는다(아래 커밋 안 된 변경).
- **진행 중 작업 기록(D77):** 전달은 kind `deliver`다. 커밋 안 된 변경을 처리하면 stage `prepare`에서, 아니면 `push`에서 시작하고, [PR 생성]은 push 뒤 `pr`로 옮긴다. 고른 전달, verify task, 변경의 처리, 브랜치, 기준 브랜치를 함께 두고, 변경을 처리하며 만든 stash나 커밋은 push로 옮길 때 더한다. 정리는 kind `clean`, stage `worktree`로 시작해 worktree를 지우면 `branches`로 옮긴다. `--force` 여부, 지울 브랜치, 정리 전 worktree의 HEAD를 함께 둔다. 기록이 있는 동안에는 전달과 정리를 받지 않는다. 재시작 때 남은 기록은 그대로 둔다(알림은 M6).
- **push(7-4):** worktree에서 `git push --set-upstream origin refs/heads/relay/<work-id>:refs/heads/relay/<work-id>`로 같은 이름에 보낸다. 사용자의 자격 증명과 pre-push 훅을 그대로 쓰고, 강제 push는 하지 않는다. 제한 시간은 5분이다.
- **비교 URL(7-4):** origin의 fetch 주소(`git remote get-url`)를 https, ssh://, git://, scp 꼴(`[user@]host:owner/repo`)로 읽어 `https://<host>/<owner>/<repo>/compare/<기준 브랜치>...<브랜치>?expand=1`을 만든다. gh의 `--web`과 같은 꼴이다(3절). 호스트는 소문자로 바꾸고 `www.`을 떼고, 레포 이름의 `.git`을 뗀다. 경로가 소유자와 레포 두 조각이 아니거나 로컬 경로면 만들지 않고 없다고 보인다.
- **PR(7-4, D62, D71):** gh는 메인 체크아웃에서 부른다. 먼저 `gh pr list --repo <레포> --head <브랜치> --state open`으로 같은 브랜치의 열린 PR을 찾고, 있으면 링크만 기록한다(draft 설정은 보지 않음). 없으면 `gh pr create --repo <레포> --base <기준 브랜치> --head <브랜치> --title <제목> --body-file <임시 파일>`로 만들고, draft 설정이 켜져 있으면 `--draft`를 더한다. `--head`를 주므로 gh는 push하지 않는다. 본문은 명령줄 길이와 인용을 피하려고 임시 파일로 준다. `GH_PROMPT_DISABLED`와 `GH_NO_UPDATE_NOTIFIER`를 켠다. `<레포>`는 origin 주소를 비교 URL과 같은 규칙으로 읽은 `HOST/OWNER/REPO`다. gh는 원격이 여럿이면 upstream을 먼저 고르고, `--repo`의 URL은 `git@`나 `https:` 따위로 시작할 때만 읽기 때문이다(3절). 읽을 수 없으면 주소를 그대로 넘기고 gh의 오류를 보인다. `pr.md`는 첫 줄의 `# ` 뒤가 제목이고 나머지가 본문이다. 본문 앞의 빈 줄과 끝의 공백은 뗀다.
- **알려진 한계:** origin 주소가 ssh 별칭(`~/.ssh/config`의 Host)을 쓰면 비교 URL과 `--repo`의 호스트가 별칭이라 맞지 않는다. gh는 원격에서 고를 때만 별칭을 푼다(3절). 이때 [PR 생성]은 push 뒤 PR 단계에서 실패하므로, [전달 없이 완료]한 뒤 브라우저에서 PR을 만든다.
- **커밋 안 된 변경(7-5):** [push]·[PR 생성]을 누르면 worktree의 `git status`를 본다. 변경이 있으면 전달하지 않고 목록을 돌려주고, 선택지 대화상자가 목록을 보인다. 고른 처리는 대화상자에 보인 목록과 지금 목록이 같을 때만 받는다. 다르면 새 목록으로 다시 고른다. [변경 버리고 진행]은 `git stash push --include-untracked --message "relay(<work-id>): 완료 전 버린 변경"`이다. stash는 레포에 하나(`refs/stash`)라 메인 체크아웃의 `git stash list`에 보인다(3절). [커밋하고 진행]은 `git add -A` 뒤 `git commit --message "relay(<work-id>): 완료 전 남은 변경"`이고, 사용자의 커밋 훅과 서명 설정을 그대로 쓴다. 둘 다 무시하는 파일은 건드리지 않는다. 만든 stash 커밋과 커밋은 전달 결과의 `stashes`, `commits`에 남긴다. 이 Work의 모든 시도가 만든 것을 모은다: 전달이 실패해도 남기고, [다시 시도]가 성공하거나 [전달 없이 완료]해도 앞 시도의 것이 이어진다. 전에는 성공한 시도가 만든 것만 남아, 실패 뒤 [다시 시도]가 성공하면 앞 시도의 stash와 커밋이 기록에서 빠졌다(PR #7 리뷰).
- **정리 세션([AI 세션 열기], 7-5):** verify 세션을 끝내고 worktree에서 새 Claude Code 세션을 연다. 기록하지 않는 일반 터미널이라 task를 만들지 않고, 세션 id, 스킬, 첫 프롬프트, `context.md`가 없다. 설정 파일에는 task와 같은 deny 규칙(push와 PR, 이전 task 디렉터리, D17), 자동 메모리 끔(D113), 훅(`/hook/cleanup/<Event>`, 토큰은 세션마다)을 넣는다. 세션 상한(D18)을 따라 자리가 없으면 대기열에서 기다린다. 탭 이름은 "정리 세션"이고, 다시 열면 새 탭이다. 턴이 끝날 때(Stop)마다 `git status`를 보고 깨끗하면 [정리 끝 → push/PR 진행]을 강조하고, 사람이 새 요청을 보내면 강조를 끈다. 버튼을 누르거나 세션이 끝나면(`/exit`) `git status`가 깨끗할 때만 원래 고른 전달을 하고, 변경이 남았으면 선택지로 돌아간다. 정리 세션이 열려 있는 동안 전달 버튼은 막는다. 앱을 끝낼 때 정리 세션도 끝내고(종료 확인에 셈), 재시작 뒤에는 남지 않는다.
- **다시 점검(D118):** verify task를 시작할 때 `context.md`를 쓰기 전에 `origin` 원격과 `gh auth status`를 다시 보고 `project.json`에 쓴다. 점검이 실패하면 앞의 결과를 쓰고 Work의 문제로 알린다. [다시 점검]은 비활성화된 전달 버튼의 이유 아래에 보인다. [재개]로 세션을 다시 열 때는 `context.md`를 다시 쓰지 않으므로 점검하지 않는다.
- **마무리 안내 문구(D104):** verify는 누를 수 있는 전달 버튼을 모두 적는다(예: "[완료만], [push], [PR 생성] 중 하나를 누르세요"). [완료만]뿐이면 "[완료만]을 누르세요"다. 승인하면 멈출 때의 버튼도 늘 함께 적는다: "[이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요"(D119). [이 단계 끝나면 멈춤]은 task가 도는 중에도 켜고 끌 수 있고, 이전 단계 추천은 에이전트가 마지막에 정하며, 스킬은 문구를 그대로 찍어서 한쪽을 골라 적을 수 없다. 전에는 전달 버튼만 적어 승인 화면의 [승인하고 멈춤]과 달랐다(PR #7 리뷰).
- **완료한 Work의 화면:** Work 완료 화면은 읽기 전용이다. 패널 위에 전달 결과(push한 브랜치, PR 주소와 이미 열린 PR인지·draft인지, [push]면 비교 URL)를 보이고, 주소는 [브라우저에서 열기]로 연다. 메인 프로세스는 http와 https 주소만 연다.
- **정리할 수 있는 Work(8):** 완료와 포기한 Work다. [Work 정리]는 액션 바에 있다.
- **정리 요약(8-1):** 대화상자를 열 때 git에서 새로 읽는다: worktree가 있는지, 커밋 안 된 변경, worktree의 git 폴더에 남은 잠금 파일(`*.lock`), 이 앱의 살아 있는 세션(정리 세션 포함), 작업 브랜치, 되감기 백업 브랜치(D115). push됐는지는 브랜치 커밋이 `refs/remotes/origin/<브랜치>`의 조상인지, 머지됐는지는 기준 브랜치(로컬이나 `refs/remotes/origin/<기준 브랜치>`)의 조상인지로 본다. fetch하지 않는다(앱의 push는 원격 추적 브랜치도 바꿈, 3절). 확인이 필요한 것(커밋 안 된 변경, 살아 있는 세션, 잠금 파일)이 있으면 확인 체크박스를 켜야 [정리]를 누를 수 있다. 작업 브랜치 삭제는 push됐거나 머지됐을 때만 체크박스를 보이고 기본은 끈다. 백업 브랜치의 "함께 삭제"는 기본으로 켠다.
- **[정리](8-2):** 요약을 본 뒤 커밋 안 된 변경, 잠금 파일, 살아 있는 세션 수, 백업 브랜치가 바뀌었으면 받지 않고 다시 열게 한다. 살아 있는 세션을 트리째 끝내고 기다린 뒤, 메인 체크아웃에서 `git worktree remove`로 지운다. 커밋 안 된 변경이나 잠금 파일이 있으면 `--force`를 준다. worktree 폴더가 이미 없으면 `git worktree prune`만 한다. 그 뒤 고른 브랜치를 `git branch -D`로 지운다. 산출물(`works/<work-id>/`)과 `events.jsonl`은 그대로다. git이 실패하면 Work의 문제로 알리고 기록을 지우며 Work는 그대로 둔다. worktree를 지운 뒤 브랜치 지우기가 실패하면 worktree 없는 Work로 남고 다시 정리할 수 있다.
- **보관된 Work:** `work.json`의 `cleaned`에 정리한 때, 정리 전 HEAD, `--force` 여부, 지운 브랜치를 남기고 `work.cleaned`를 기록한다. 사람이 worktree 폴더를 먼저 지웠으면 정리 전 HEAD는 작업 브랜치의 커밋이다. 화면은 읽기 전용이고, git은 메인 체크아웃에서 부른다. [변경] 탭과 전체 변경은 작업 트리 대신 정리 전 HEAD까지 본다. 브랜치를 지웠으면 그 커밋은 레포의 gc가 치우기 전까지만 보인다.
- **이벤트(5.5):** 전달은 `delivery.succeeded`(브랜치, 비교 URL, PR 주소, 이미 열린 PR, draft, stash와 커밋)와 `delivery.failed`(전달, 단계, 오류, stash와 커밋)를 남긴다. stash와 커밋은 그때까지의 전달 결과에 모인 것이다. `work.completed`의 `payload.delivery`는 `none`, `push`, `pr`이다. 정리는 `work.cleaned`(`forced`, `deleted_branches`)다. 5.5에 없는 유형은 더하지 않았다.
- **Linux의 10초:** verify 세션을 끝내는 [push]·[PR 생성]·[AI 세션 열기]와, 정리 세션을 끝내는 [정리 끝 → push/PR 진행]도 [즉시 중단]처럼 Linux에서 10초 늦다(3절).

### M6. 복구

**내용**

- 고아 프로세스 종료(D76), 끊긴 여러 단계 작업의 알림과 [다시 시도]·[무시](D77), 앱 소유 파일 해시 경고(D91), 잘린 `pty.log` 표시.

**완료 기준**

- [어댑터] 앱 역할 프로세스를 강제 종료한 뒤 남은 프로세스를 ID와 시작 시각으로 찾아 종료한다. 시작 시각이 다르면 건드리지 않는다.
- [흐름] 되감기, 전달, 정리 도중에 끊긴 기록이 있으면 재시작 때 어디서 끊겼는지 알린다.
- [흐름] 스크립트로 바꾼 `work.json`을 경고한다.
- [실기] 작업 관리자로 앱을 끝낸 뒤 다시 켜서 상태를 확인한다.

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. 설계를 바꾼 것은 D121~D126, I33이다)

- **재시작 순서(시나리오 9):** 모든 Work의 `work.json`을 읽고, 기록한 프로세스를 모아 한 번 확인해 끝낸 뒤(9-1), Work마다 조정한다(9-2~9-6). 조정은 OS 알림을 보내지 않는다.
- **확인하는 프로세스(D76, D126):** 모든 task의 세션(끝난 세션 포함)과 살아 있던 정리 세션 가운데 시작 시각을 적은 것이다. 끝난 세션도 넣는다: SessionEnd 뒤에 늦게 끝나는 프로세스가 있고, 시작 시각까지 같으면 같은 프로세스다. 시작 시각이 없으면 재사용된 ID를 가리지 못해 넣지 않는다.
- **트리 모으기와 끝내기:** 프로세스 목록을 한 번 읽어(Windows는 PowerShell의 Win32_Process, Linux는 `/proc`) 기록과 ID·시작 시각이 같은 프로세스를 찾고, 부모 ID로 자손을 모은다. 부모 ID는 재사용된 ID를 가리킬 수 있어 부모보다 먼저 시작한 프로세스는 자식으로 보지 않는다(3절). 모은 프로세스를 모두 강제로 끝내고(Node `process.kill`의 `SIGKILL`: Windows는 무조건 종료, Linux는 SIGKILL, 3절) 목록에서 없어질 때까지 기다린다(최대 10초).
- **끝낸 것의 기록:** 실행 중이던 task의 세션을 끝냈으면 그 task의 조정 이벤트(`task.interrupted`, `task.awaiting_approval`)에 `killed_pid`를 더한다. 정리 세션은 이벤트를 남기지 않는다(D126). 알림은 Work마다 "앱을 다시 켜며 남아 있던 프로세스를 끝냈습니다"와 "<task>의 claude (PID n)" 줄이다.
- **Linux의 시작 시각(I33):** starttime을 CLK_TCK로 나누고 btime을 더해 ms까지의 ISO 8601(UTC)로 적는다. CLK_TCK는 `getconf CLK_TCK`로 한 번 읽고, 읽지 못하면 100이다. 좀비(Z)와 죽은(X) 프로세스는 끝난 것으로 본다. btime은 벽시계를 설정하면 바뀌므로(3절) 그 사이에 시계를 설정했으면 같은 프로세스도 시작 시각이 달라 끝내지 않는다. 건드리지 않는 쪽으로 틀린다. macOS 등 그 밖의 OS는 시작 시각이 없어 확인하지 않는다.
- **끊긴 작업의 표시(D121, D122):** 조정은 남은 진행 중 작업 기록에 `interrupted_at`을 적는다. 이것이 있으면 끊긴 작업이다: 배지 "끊긴 작업", 패널 맨 위의 알림, 액션 바의 조작은 Work 설정만 보이고, 승인과 전달 버튼은 누를 수 없다. 받지 않는 명령은 "끊긴 작업이 있음: 먼저 [다시 시도]나 [무시]를 누르세요"로 거부한다. [다시 시도]가 시작하면 `interrupted_at`을 지워 다시 진행 중인 작업이 된다. 또 끊기면 다음 재시작 때 다시 끊긴 작업이다.
- **되감기의 [다시 시도](D123):** 지금 HEAD, 커밋 안 된 변경, 이미 만든 백업을 git에서 본다. 이미 만든 백업은 reset 단계면 기록한 것이고, backup 단계면 계획한 이름의 브랜치가 있을 때다(기록하기 전에 끊김). 기록이 있는 동안 이 Work의 다른 되감기는 없으므로 그 이름의 브랜치는 끊긴 되감기가 만든 것이다.
  - 코드가 이미 되돌릴 커밋이고 깨끗하면 백업도 되돌리기도 하지 않는다.
  - 이미 만든 백업이 지금 코드와 같으면(HEAD가 백업할 때의 HEAD이고, 작업 트리의 tree가 백업 커밋의 tree) 다시 만들지 않는다. 작업 트리의 tree는 백업 커밋처럼 다른 index 파일로 만든다(D116).
  - 아니면 다음 번호로 백업한 뒤 되돌린다. 이미 만든 백업이 있으면 새 task의 선택 기록(`selection.reset`)에는 처음 백업을 남기고(폐기한 task의 [변경]이 본다), 이번 백업은 `task.rewound`의 `extra_backup_branch`로 남긴다.
  - 백업할 때의 HEAD는 기록(`operation.head`, M6부터 보통의 되감기도 적음)이나, 백업 커밋에서 읽는다: 커밋 안 된 변경을 담은 백업 커밋은 메시지(D116)로 알아보고 그 부모, 아니면 그 커밋이다.
- **전달의 [다시 시도]·[무시](D123):** 둘 다 먼저 끊긴 시도가 만들었지만 기록하지 못한 stash와 커밋을 찾는다. [변경 버리고 진행]이면 stash 목록에서 제목이 이 Work의 stash 메시지인 것, [커밋하고 진행]이면 HEAD의 제목이 이 Work의 커밋 메시지일 때 HEAD다. 전달 결과에 이미 있는 것은 뺀다. 그리고 끊긴 시도를 `delivery.failed`(오류 "앱이 꺼져 끊김", `reason: app_restart`)로 남긴다. [다시 시도]는 이어서 같은 전달을 처음부터 한다: 이미 push한 커밋은 git이 다시 보내지 않고, 같은 브랜치의 열린 PR이 있으면 링크만 남긴다(7-4). 커밋 안 된 변경이 남았으면 그 자리에서 선택지를 다시 보인다. [무시] 뒤의 Work 완료 화면은 M5의 실패처럼 [다시 시도]·[전달 없이 완료]다.
- **정리의 [다시 시도](D123):** worktree 단계에서 끊겼으면, 폴더가 없으면 `git worktree prune`만 한다. `.git` 파일이 없으면(git이 지우다 멈춤) `git worktree remove`가 거부하므로(3절) prune한 뒤 남은 폴더를 지운다. 있으면 `git status`를 다시 본다: 기록이 `--force`였으면 `--force`로, 아니면 남은 변경이 지우다 만 추적 파일(` D`, `D `, `DD`)뿐일 때만 `--force`로 지운다. 다른 변경이 생겼으면 멈추고 [Work 정리]로 다시 확인하게 한다. 브랜치는 아직 있는 것만 지운다(없는 이름이 섞이면 `git branch -D`가 실패함, 3절). `cleaned.deleted_branches`는 기록한 목록 그대로다.
- **[무시](D123):** 되감기와 정리는 기록만 지운다. 되감기는 task를 폐기하지 않아 단계를 고르기 전의 Work 그대로이고, 다시 [단계 선택]을 할 수 있다. 정리는 [Work 정리]를 다시 할 수 있다.
- **앱 소유 파일의 해시(D124, D125):** `work.json`의 `file_hashes`에 `request.md`, `intent.md`, `decisions.md`의 `sha256:<hex>`(파일 바이트의 해시)를 적는다. Work를 만들 때 `request.md`, intent를 확정할 때 `intent.md`, 결정 로그에 덧붙일 때 `decisions.md`를 적는다. 비교하는 때는 재시작 때 세 파일, `context.md`를 만들 때 세 파일, intent를 새 버전으로 바꿀 때 이전 `intent.md`, 결정 로그에 덧붙일 때 덧붙이기 전의 `decisions.md`다. 없어진 파일과 앱이 쓰지 않았는데 생긴 파일도 다르다고 본다.
  - 알림 줄은 "<파일>: 내용이 바뀜 | 없어짐 | 앱이 쓰지 않았는데 생김 (<확인한 때>) — <경로>"다. 같은 내용을 다시 읽으면 다시 넣지 않는다. [확인]은 알림에 든 파일의 지금 해시를 적고(없으면 지움) 알림을 닫는다.
  - 알림은 앱의 메모리에만 있다. [확인]하지 않고 다시 켜면 다시 비교해 알린다. `file_hashes`가 없는 Work(M6 전)는 재시작 조정이 경고 없이 적는다.
- **`work.json`의 비교(D124):** 앱은 Work를 읽거나 쓸 때 그 내용을 기억하고, 쓰기 전에 파일을 읽어 비교한다. 다르면 파일의 내용을 `work.json.changed-<현지 시각 YYYYMMDDTHHMMSS>`로 남기고(이름이 겹치면 `-2`, `-3`…) 앱의 상태로 쓴다. 파일이 없어졌으면 남길 것이 없다. 알림 줄은 "<확인한 때>: 바뀐 내용 — <옆 파일>"이다.
- **정리 세션의 기록(D126):** 세션을 띄운 뒤 `cleanup_process`(프로세스 ID, 시작 시각, 띄운 때)를 적고, 세션이 끝나면([정리 끝 → push/PR 진행], `/exit`, [Work 포기], 앱 종료) 지운다. 재시작 조정은 남은 기록을 지운다(끝내는 것은 9-1).
- **잘린 `pty.log`(9-5):** 끝난 task의 탭은 `pty.log`를 바이트로 읽어 UTF-8로 풀고 끝의 덜 쓴 글자는 버린다(`TextDecoder`의 stream, 3절). 가운데의 잘못된 바이트는 대체 문자로 보인다. 경고하지 않는다.
- **이벤트(5.5):** 재시작 때 끝낸 task의 세션은 그 task의 `task.interrupted`·`task.awaiting_approval`에 `killed_pid`를 더한다. 끊긴 전달은 `delivery.failed`에 `reason: app_restart`를 더한다. 끊긴 되감기를 다시 하며 덤으로 남긴 백업은 `task.rewound`의 `extra_backup_branch`다. 5.5에 없는 유형은 더하지 않았다.
- **알림의 화면(D121):** 패널 맨 위에 끊긴 작업(무엇이 어디서 끊겼는지, [다시 시도]·[무시]가 할 일), 끝낸 고아 프로세스, 바뀐 앱 소유 파일, 바뀐 `work.json`의 차례로 보인다. 끊긴 작업 말고는 [확인]으로 닫는다.
- **시험에서 끊긴 모습 만들기:** [흐름]은 앱이 명령을 받아 쓴 `work.json`을 core의 전이로 만들고, git은 끊긴 곳까지 한 일(백업, push, stash, 반쯤 지운 worktree)을 손으로 한다. 앱을 끈 뒤 그 `work.json`과 끊기기 전의 `events.jsonl`을 두고 다시 켠다. 살아남은 claude의 자리는 분리해 띄운 프로세스 트리다. [스모크]는 앱을 끈 뒤 첫 Work의 `work.json`에 끊긴 되감기 기록을 손으로 넣는다.

### M7. 자동 승인

**내용**

- 단계별 설정과 Work별 덮어쓰기(4.2, D72), 조건 판정(4.3), 카운트다운과 [취소], 새 요청으로 취소, 알림(D81), 재시작 경로에서는 자동 승인하지 않음(D75), `decisions.md`의 승인 방식.

**완료 기준**

- [단위] 4.3의 조건을 하나씩 어기면 자동 승인되지 않는다.
- [흐름] 조건을 모두 만족하면 카운트다운 뒤 자동 승인된다. 카운트다운 중에 [취소]를 누르거나 새 요청이 오면 멈춘다.
- [실기] 카운트다운 시작 알림이 오고, 승인 화면에서 취소할 수 있다.

## 8. 테스트 전략

### 8.1 시험의 층

| 꼬리표 | 대상 | 도구 | 어디서 | 언제 |
|---|---|---|---|---|
| [단위] | `core` | Vitest | Linux 러너 | push, PR (I28) |
| [어댑터] | `adapters`: 실제 git, 파일, node-pty, HTTP 서버, 프로세스 종료 | Vitest | Windows 러너 | push, PR |
| [흐름] | `main` 조립 + `adapters` + 가짜 `claude`(I25, I26) | Vitest | Windows 러너 | push, PR |
| [스모크] | 설치 파일과 화면(I27) | Playwright `_electron` | Windows 러너 | 수동. 설치 파일 워크플로 |
| [실제] | 앱 흐름 + 실제 `claude` + 스킬(I29) | Vitest와 시험 도구(I17) | Windows 러너 | 수동. 마일스톤 완료, Claude Code 업데이트 때 |
| [실기] | 한글 IME, 알림, 화면, 사용감 | 사람 | Windows 10/11 PC | 마일스톤 완료 때 |

- 비용: 공개 레포라 러너 시간은 무료다. 비용이 드는 것은 [실제]의 Claude 사용량뿐이다.
- [흐름]과 [실제]는 같은 시험 코드를 쓰고 `claude` 실행 파일만 바꾼다. 앱은 `CLAUDE_BIN` 환경 변수로 실행 파일을 받는다(6절 `resolveClaude`).

### 8.2 가짜 claude (I25)

- 위치: `app/test/fake-claude/`. Node 스크립트이고 PTY 안에서 실행된다.
- 입력: 실제와 같은 인자(`--settings`, `--session-id`, `--resume`, `--add-dir`, 첫 프롬프트)와 환경 변수 `RELAY_HOOK_TOKEN`. 시나리오 파일 경로는 환경 변수 `FAKE_CLAUDE_SCENARIO`로 받는다 **(기본값)**.
- 동작: 설정 파일에서 훅 URL과 머리글을 읽어 신호를 보낸다. 본문 필드는 S2에서 관찰한 모양(`session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, 도구 이름과 입력, `stop_hook_active`)을 따른다.
- 시나리오 파일은 단계 목록이다: 신호 보내기, 산출물과 handoff 쓰기, worktree에 커밋하기, 커밋하지 않고 worktree 고치기(M4, D116), 질문 대기 흉내(`AskUserQuestion`의 PreToolUse와 PostToolUse), Stop 보내고 응답 확인, 되돌림을 받았을 때 쓸 내용, 종료.
- 가짜 `gh`도 같은 방식으로 두고, 받은 인자를 파일에 남긴다 **(기본값)**.
  - 위치는 `app/test/fake-gh/gh.mjs`다. `auth status`, `pr list`, `pr create`를 흉내 내고, 인자와 cwd, `--body-file`의 내용을 `FAKE_GH_RECORD` 폴더의 `fake-gh.jsonl`에 한 줄씩 남긴다. 만든 PR은 같은 폴더의 `prs.json`에 두어 같은 `--repo`와 `--head`로 찾는다.
  - 로그인 실패(`FAKE_GH_AUTH=fail`), 이미 열린 PR(`FAKE_GH_OPEN_PR`), 명령 실패(`FAKE_GH_FAIL=list|create`)를 환경 변수로 흉내 낸다. `--repo`가 로컬 경로면 head 브랜치가 그 레포에 push되어 있어야 PR을 만든다.

### 8.3 워크플로

| 파일 | 실행 | 하는 일 |
|---|---|---|
| `.github/workflows/app-ci.yml` | push, PR (`app/`, `skills/`, `docs/contracts/`가 바뀔 때) | Linux: 타입 검사, ESLint, Prettier 확인, [단위], `skills/check.mjs` **(기본값)**. Windows: [어댑터], [흐름] |
| `.github/workflows/app-build.yml` | 수동 | 설치 파일 빌드, 조용한 설치, [스모크], 설치 파일을 결과물로 올리기(I8) |
| `.github/workflows/app-claude.yml` | 수동 | [실제]. 입력: 모델, effort. 인증은 스파이크 워크플로와 같은 레포 secret |

### 8.4 실제 claude 시험 (I29)

- 시험 레포: 작은 Node 레포 두 개를 시험 때 만든다 **(기본값)**. 버그 하나와 `npm test`(의존성 없는 `node:test`)가 있다.
- 경로: 의도 승인 때 시험 도구가 `size`를 골라(D90) M 경로와 S 경로를 하나씩 돌린다.
- 사람 역할: 첫 실행 창은 I17의 도구로 수락하고, 질문(`AskUserQuestion`)에는 첫 선택지(추천)로 답한다. 승인 대기가 되면 [승인]한다.
- 판정: Work 완료까지 갔는지, task마다 형식 오류 되돌림 횟수, [오류 무시하고 승인]을 쓴 횟수(0이어야 함), 걸린 시간.
- 재개(M3): intake 세션에 표식을 알려 준 뒤 [즉시 중단]하고 [재개]한다. 다시 연 세션에 표식을 파일에 쓰게 해 파일로 판정한다(다시 연 화면에는 앞 대화가 보여 화면으로는 가를 수 없음).
- 되감기(M4, 사용자 결정): S 경로 레포에서 최종 검증이 승인 대기가 되면 [단계 선택]으로 되감고 Work 완료까지 간다. 가짜 `claude`로는 스킬이 `context.md`의 되감기 절을 따르는지 볼 수 없어서 둔다.
  - rewind-intake: 완료조건을 하나 더하라는 추가 지시와 함께 intake로 되감는다. intent v2가 v1을 출발점으로 고쳐졌는지(완료조건이 늘고 v1 항목이 남는지, D40), 되돌린 수정 커밋이 백업 브랜치에 있는지 본다.
  - rewind-fix: 재현 테스트 이름을 정한 추가 지시와 함께 fix로 되감는다. 되감은 fix가 추가 지시를 따랐는지, 되돌린 커밋이 백업 브랜치에 있는지 본다.
- 전달(M5, 사용자 결정): S 경로 레포에서 최종 검증이 승인 대기가 되면, 사람 역할이 worktree에 커밋 안 된 메모를 남기고 [PR 생성]을 누른다. 선택지에서 [AI 세션 열기]로 정리 세션을 열어 메모를 지워 달라고 하고, git status가 깨끗해지면 [정리 끝 → push/PR 진행]을 누른 뒤 [Work 정리]를 한다. 실제 스킬이 쓴 `pr.md`가 PR 제목과 본문으로 가는지, 에이전트가 스스로 push하지 않는지, 첫 프롬프트 없이 연 정리 세션이 요청을 받아 일하고 Stop 훅이 오는지 본다. gh는 가짜 gh다(시험 환경에 gh 로그인이 없음). 실제 PR은 [실기]에서 본다.
- `RELAY_REAL_CASES`로 돌릴 경우(M, S, resume, rewind-intake, rewind-fix, deliver. rewind는 둘 다)를 고른다.
- 결과는 실행 요약과 결과물에 올리고, 사람이 `docs/checks.md`에 옮긴다(I30). 러너 결과는 예비 확인으로 적는다(D93과 같음).

### 8.5 실기 확인 (I30)

- 마일스톤마다 7절의 [실기] 항목을 Windows 10/11 PC에서 사람이 확인한다.
- 결과는 `docs/checks.md`에 날짜, 앱 커밋, Claude Code 버전, OS와 함께 한 줄씩 더한다.

## 9. 설계의 빈 곳

구현 계획을 정하며 찾은 설계의 빈 곳과, 그것을 정한 결정이다. 설계를 바꾼 결정(D 번호)은 `docs/design.md` 2절에 있다.

| # | 빈 곳 | 정한 곳 |
|---|---|---|
| G1 | 스킬 원본을 `<RELAY_HOME>/skills/`에 두는 방법이 없었다 | D103 |
| G2 | 훅 서버의 보안과 task 구분이 없었다 | I13 |
| G3 | `context.md`의 마무리 안내 문구의 내용이 없었다 | D104 |
| G4 | 확인한 버전과 다른 Claude Code가 설치되어 있을 때 할 일이 없었다 | D105 |
| G5 | 앱이 `claude` 실행 파일을 찾는 방법이 없었다 | D106 |
| G6 | 형식 오류 되돌림의 연속 횟수가 언제 0으로 돌아가는지 없었다 | D107 |
| G7 | 트리 종료한 세션의 `--resume`을 확인하지 않았다 | I31, 스파이크 S6 |
| G8 | 배포할 relay 스킬의 범위가 없었다 | D108 |
| G9 | 노드의 화면 이름이 없었다 | D109 |
| G10 | SessionEnd가 `/clear`, `/resume`에도 와서, 세션 종료로 보면 CLI가 계속 도는데 신호를 무시하게 된다(M1 구현 중에 찾음) | D110 |
| G11 | 설정 파일에 직접 쓴 권한 규칙은 경로의 gitignore 패턴 문자를 이스케이프하지 않아, 레포 폴더 이름에 `[`, `]` 등이 있으면 project-id가 든 deny 규칙이 맞지 않는다(M2 구현 중에 찾음) | D111 |
| G12 | 형식 오류가 끝까지 남은 task는 대기나 세션 종료가 되는데, [오류 무시하고 승인]을 언제 누를 수 있는지, handoff 머리글을 읽지 못하면 결정과 이전 단계 추천을 어떻게 할지 없었다(M2 구현 중에 찾음) | D112 |
| G13 | Claude Code의 자동 메모리가 task와 Work 사이를 `context.md` 밖으로 잇는다. 되감기의 폐기(D22)도 메모리는 빼지 못한다(스파이크 S6에서 찾음) | D113 |
| G14 | handoff 없이 끝난 세션의 [이 단계 새 세션으로 다시]가 새 task인지 같은 task의 새 세션인지 없었다(M3 구현 전에 찾음) | D114 |
| G15 | 백업 브랜치 이름 `relay/<work-id>/discarded-<n>`은 Work 브랜치 `relay/<work-id>`가 있으면 git이 만들지 않는다(M4 구현 전에 찾음) | D115 |
| G16 | 코드 되돌림(`git reset --hard`)이 worktree의 커밋 안 된 변경을 백업 없이 지운다(M4 구현 전에 찾음) | D116 |
| G17 | 실행한 적 없는 단계(S 경로의 evidence·rca)나 새 세션으로 다시 한 task(D114)가 있을 때 되돌릴 커밋이 없었다. 건너뛰기에서 진행 중인 fix의 코드 커밋을 폐기하는지 없었다(M4 구현 전에 찾음) | D117 |
| G18 | 전달 버튼의 점검(D67)을 등록 때 한 번만 해서, 등록 뒤에 gh를 설치하거나 로그인해도 [PR 생성]이 계속 비활성화되어 있었다(M5 구현 전에 찾음) | D118 |
| G19 | verify에서 멈춘 Work의 [재개]는 전달 없이 Work를 완료해서 push나 PR을 고를 곳이 없었다. 승인하면 멈추는 verify에서 [push]·[PR 생성]이 무엇을 하는지 없었다(M5 구현 전에 찾음) | D119 |
| G20 | 전달이 실패했을 때 verify 승인을 남겼는지와 Work의 상태가 없었다(M5 구현 전에 찾음) | D120 |
| G21 | 재시작 때 끝낸 고아 프로세스, 끊긴 여러 단계 작업, 앱 밖에서 바뀐 앱 소유 파일을 알릴 곳이 없었다. 정리가 끊긴 Work는 배지가 "완료"라 눈에 띄지 않았다(M6 구현 전에 찾음) | D121 |
| G22 | 끊긴 작업의 기록이 남은 동안 전달과 정리만 막아, 승인하면 되돌린 코드로 다음 단계가 시작하거나 기록이 남은 채 Work가 완료됐다. 단계 선택은 끊긴 기록을 조용히 지웠다(M6 구현 전에 찾음) | D122 |
| G23 | [다시 시도]가 끊긴 곳부터 잇는지 처음부터 하는지, [무시]가 무엇을 남기는지 없었다(M6 구현 전에 찾음) | D123 |
| G24 | 앱 소유 파일의 해시를 언제 비교하고 경고를 어떻게 끄는지, 실행 중에 읽지 않는 `work.json`을 언제 비교하고 다를 때 무엇을 하는지 없었다(M6 구현 전에 찾음) | D124 |
| G25 | 배포한 스킬(D103)도 해시로 확인하는지 없었다(M6 구현 전에 찾음) | D125 |
| G26 | 정리 세션은 `work.json`에 남기지 않아 앱이 충돌한 뒤 살아남으면 찾을 수 없었다(M6 구현 전에 찾음) | D126 |
| G27 | 프로세스의 시작 시각을 Windows에서만 읽어 Linux에서는 고아를 확인할 수 없었다(M6 구현 전에 찾음) | I33 |
