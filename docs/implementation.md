# relay-v2 구현 계획

- 대상 설계: `docs/design.md` v0.4 (MVP, M0~M7)와 v0.5의 확장(리뷰 단계와 PR 진행, M8~M11, I41)
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
| I28 | push와 PR마다 두 작업을 돌린다. Linux: 타입 검사, lint(ESLint, Prettier **(기본값)**), core 단위 시험. Windows: adapters 시험과 가짜 `claude` 흐름 시험. 설치 파일 빌드와 스모크, 실제 `claude` 시험은 수동으로 돌린다. I39로 더함: Windows 작업은 [어댑터] 전에 앱을 빌드한다 | 공개 레포라 러너가 무료임. core는 Node API를 쓰지 않아 Linux에서 빨리 결과가 나옴. 주 플랫폼 문제는 Windows 작업이 잡음. 설치 파일 빌드는 오래 걸림 | ✅ |
| I29 | 실제 `claude` 흐름 시험은 수동 워크플로로, 마일스톤 완료 때와 Claude Code를 올릴 때 돌린다. 시험 레포 두 개(M 경로, S 경로)를 시험 때 만들고 **(기본값)**, 질문에는 첫 선택지로 답한다. 모델과 effort는 입력으로 받고 기본은 `sonnet`, `low`다 **(기본값)**. 끝까지 갔는지, task마다 되돌림 횟수, 걸린 시간을 판정한다 | 한 번에 세션이 8개 돌아 Claude 사용량이 가장 큰 시험임. 스킬이나 Claude Code가 바뀔 때만 의미가 있음. 되돌림 횟수는 스킬 템플릿이 잘 맞는지 보는 지표도 됨 | ✅ |
| I30 | 마일스톤마다 실기 확인 항목을 7절에 두고, 실제 `claude` 시험과 실기 확인의 결과는 `docs/checks.md`에 날짜, 앱 커밋, Claude Code 버전, OS와 함께 기록한다 | 스파이크 결과(D92)와 같은 방식. Claude Code 버전이 바뀌었을 때 무엇을 다시 확인할지 알 수 있음 | ✅ |
| I31 | 스파이크 S6(강제 종료 뒤 `--resume`)을 M3 전에 러너에서 돌린다. 계획은 `docs/spikes.md`에 둔다 | [즉시 중단]은 트리 종료인데 S3는 `/exit`로 끝낸 세션만 확인함. 결과에 따라 M3의 설계가 바뀔 수 있어 먼저 알아야 함 | ✅ |
| I32 | PTY는 `useConpty: true`, `useConptyDll: true`로 띄운다. node-pty에 들어 있는 `conpty.dll`과 `OpenConsole.exe`를 쓰고 Windows 내장 ConPTY는 쓰지 않는다 | DLL 모드는 세션을 시작한 직후 의사 콘솔을 놓아(`ConptyReleasePseudoConsole`) 세션이 끝나면 `OpenConsole.exe`도 스스로 끝남. 내장 ConPTY는 트리 종료 뒤에도 `conhost.exe`가 남을 수 있음(3절). Windows 10과 11에서 같은 ConPTY를 씀. 스파이크 S1~S5는 내장 ConPTY로 확인했으므로 M0의 [실기]에서 다시 확인함 | ✅ |
| I33 | Linux에서 프로세스의 시작 시각(D76)은 `/proc/<pid>/stat`의 starttime을 CLK_TCK로 나누고 `/proc/stat`의 btime을 더해 만든다. 고아 트리는 `/proc`의 부모 관계로 모아 SIGKILL로 끝낸다 | Linux는 시험 환경뿐이지만 로컬 `npm test`가 [어댑터]와 [흐름]을 돌린다. 시작 시각이 없으면 재사용된 ID를 가리지 못해 고아를 확인할 수 없음. Linux에서도 다른 프로세스가 PTY의 master를 쥐고 있으면 앱이 꺼져도 세션이 살아남았음(3절) | ✅ |
| I34 | 앱이 하나인지는 Electron의 `app.requestSingleInstanceLock()`으로 막는다(D133). 잠금을 잡지 못하면 `Relay.open` 전에 `app.exit(0)`으로 끝내고, 잡은 앱은 `second-instance`에서 창을 앞으로 가져온다. 판단은 `main/instance.ts`에 두고 [단위]로 시험한다 | 잠금이 relay를 열기 전이어야 두 번째 앱이 고아 확인(9-1)을 하지 않음. `exit`는 `before-quit`을 부르지 않아 종료 확인 창이 뜨지 않음. 잠금은 Electron의 userData 폴더마다라, 개발용 실행과 설치한 앱은 서로 막지 않음(같은 `RELAY_HOME`을 쓰면 A1이 남음). 사람이 정한 범위임 | ✅ |
| I35 | D135는 `WorkRunner.apply`가 한다. `work.json`을 먼저 쓰고 성공하면 메모리의 상태를 바꾼다. 쓰기가 실패하면 문제 목록에 남기고 예외를 그대로 던진다. 할 일이 하나라도 실패하면 뒤의 `startTask`·`resumeTask` 대신 `session.failed`(오류 "앞선 처리가 실패해 시작하지 않음: …")를 넣는다. 문제 목록은 지금처럼 최근 20줄을 남기고 지우지 않는다 | `session.failed`는 세션을 띄우다 실패할 때 이미 쓰는 전이라 화면과 [재개]가 같음. 자리를 잡기 전이라 풀의 자리를 돌려주지 않음. [흐름]에서 `events.jsonl`과 `work.json`을 폴더로 바꿔 실패를 만든다 | ✅ |
| I36 | D136의 "코드가 이미 바뀌었는가"는 되돌리기 직전과 실패한 뒤의 HEAD와 작업 트리 tree(`worktreeTree`, 커밋 안 된 변경과 추적하지 않는 파일 포함)를 비교해 정한다. 둘 다 같으면 전처럼 기록을 지우고, 다르거나 비교하지 못하면 끊긴 되감기로 남긴다. [단계 선택]과 끊긴 되감기의 [다시 시도]가 같은 방법을 쓴다. [흐름]은 Linux에서 `chattr +i`로 추적하지 않는 파일을 지울 수 없게 해 clean만 실패시킨다(root가 아니면 건너뜀). Windows의 잠긴 파일은 3단계 실기에서 본다 | clean만 실패하는 경우뿐 아니라 reset이 도중에 실패해 작업 트리 일부만 바뀐 경우도 잡음. index.lock처럼 아무것도 바꾸지 않은 실패는 지금처럼 다시 고를 수 있음. 비교하지 못하면 되돌린 코드로 진행하지 않는 쪽으로 틀림 | ✅ |
| I37 | D142는 `main/notices.ts`가 한다. 알림은 `click`이나 `failed`에서 놓고 `close`에서는 놓지 않는다. `app.setAppUserModelId`는 Windows 설치본(`app.isPackaged`)에서만 부르고 개발 중에는 Electron 기본값을 쓴다. 앱 ID가 `electron-builder.yml`의 appId와 같은지는 [단위]가 본다 | Windows는 토스트가 알림 센터로 옮겨 갈 때 `close`를 보내므로(Electron 문서 Notification) `close`에서 놓으면 알림 센터에서 누를 알림을 놓침. 개발 중의 실행 파일에는 그 앱 ID의 시작 메뉴 바로 가기가 없음 | ✅ |
| I38 | D146의 검사는 main이 SessionEnd 훅과 PTY 종료 때 task 파일을 다시 읽어 이벤트에 넣는다. 먼저 처리된 신호가 정하고 뒤의 것은 세션이 이미 끝나 무시된다. 이미 끝낸 세션(승인, [즉시 중단] 등)의 PTY 종료에는 읽지 않는다. 파일을 읽지 못하면 검사 없이 넣어 세션 종료로 둔다 | Windows에서 강제로 끝난 claude는 SessionEnd를 보내지 않아 PTY 종료만 옴. 파일을 읽다 실패해도 세션이 끝난 것은 남겨야 함 | ✅ |
| I39 | app-ci의 Windows 작업은 [어댑터]와 [흐름] 전에 앱을 빌드한다(`npm run build`). 설치 파일 빌드와 [스모크]는 그대로 수동이다 | Windows는 파일 이름의 대소문자를 가리지 않아, Linux에서 되는 확장자 없는 import가 Windows에서만 다른 파일로 풀릴 수 있음(A79, PR #10의 app-build #15). Linux 작업과 Windows의 시험은 앱을 빌드하지 않아 이것을 놓쳤음. 빌드는 몇 초라 push마다 돌려도 부담이 없음 | ✅ |
| I40 | 크기별 경로(D147~D151)는 `core/pipeline`의 `steps`(고를 수 있는 단계)와 `route`(지나는 단계)가 정하고, 단계 선택(`core/rewind`), `context.md`의 이전 단계, `recommended_next` 검사가 같은 `previousSteps(node, size)`를 쓴다. 스킬 합치기(D148)는 `adapters/claude`의 `SKILL_PARTS`, `soloSkill`, `composeSkill`이 하고, `skills/check.mjs`가 같은 표와 같은 방식으로 합친다. 경로는 저장하지 않고 승인된 intent의 크기로 매번 계산한다. 그래서 이 변경 전에 시작해 evidence를 지난 M Work는 새 M 경로에 evidence가 없어 rca를 건너뛰고 fix로 간다 **(알려진 제약)**: 업데이트 전에 진행 중인 M Work를 끝내거나, intake로 되감아 L로 고친다 | 경로를 `work.json`에 저장하면 읽고 옮기는 곳이 늘어남. MVP는 사용자가 하나이고 진행 중인 Work를 끝낸 뒤 올릴 수 있음 | |
| I41 | 설계 v0.5의 확장(리뷰 단계와 PR 진행, D152~D194)은 M8 리뷰 단계 → M9 PR 진행 → M10 PR 대응 → M11 자동 대응 차례로 만든다. 마일스톤 사이에 실제 버그에 써 본다 | 위험이 낮은 것부터 넣음. 에이전트가 없는 M9로 머지까지 먼저 쓰고, 자동화는 써 보고 넣음(설계 0절, I24) | ✅ |
| I42 | 스파이크 S7(GitHub 연동)을 M9 전에 시험용 레포에서 돌린다. relay-v2 레포에는 시험 PR을 만들지 않는다 | gh와 GitHub의 동작은 추측하지 않음(설계 부록 A 5항). 이 레포에 시험 PR과 브랜치가 쌓이지 않음 | ✅ |
| I43 | PR 단계의 [흐름] 시험은 가짜 gh를 늘려 PR 상태, 코멘트, 체크, 답글, 재실행, 머지를 흉내 낸다. [실제] 시험은 시험용 레포에 실제 PR을 만들어 코멘트와 머지까지 돌린다. 시험용 레포와 토큰은 레포 secret(`RELAY_TEST_GH_REPO`, `RELAY_TEST_GH_TOKEN`)으로 받는다 **(기본값)** | 실제 GitHub의 동작과 실제 스킬을 함께 확인함 | ✅ |
| I44 | 리뷰 단계(D163~D167)는 `core/pipeline`의 `STEPS`에 review를 fix와 verify 사이에 더해 만든다. 경로(`route`), 기본 다음 단계, 단계 선택(`core/rewind`), `context.md`의 이전 단계, `recommended_next` 검사가 이 표를 따른다(I40). verify의 이전 단계에 review가 들어 verify가 review로 되돌아가길 권할 수 있으므로 handoff 스키마의 `recommended_next.node`에 review를 더한다. 리뷰는 의도 승인, Work 완료와 같이 늘 수동이라(D167) `auto_approve`에 `review` 키가 있으면 켜든 끄든 받지 않는다(설정 화면과 Work 설정은 오류, `config.json`은 경고하고 기본값). 경로는 저장하지 않고 크기로 계산하므로(I40) 이 변경 전에 시작한 Work도 fix 다음에 review를 지난다. 다만 fix를 승인해 verify가 이미 생긴 Work는 review 없이 끝난다 **(알려진 제약)**: 리뷰를 거치려면 verify에서 [단계 선택]으로 review를 고른다(verify만 폐기하고 verify의 시작 커밋에서 review를 시작함). 업데이트 전에 쓴 fix의 handoff가 `recommended_next`에 verify를 적었으면 이제 기본 다음 단계(review)를 건너뛰는 추천이라 형식 오류다. [오류 무시하고 승인]으로 넘기면 review로 간다 | 노드를 빼지 않아 I40처럼 지난 단계의 산출물이 경로에서 빠지는 일은 없음. review를 지나지 않은 Work는 단계 선택으로 되돌릴 수 있음. MVP는 사용자가 하나이고 진행 중인 Work를 끝낸 뒤 올릴 수 있음 | |
| I45 | M8의 완료 기준 "review에서 만든 커밋이 verify의 [변경]과 Work 완료 화면의 전체 변경에 들어간다"를 "review의 [변경]과 Work 완료 화면의 [전체 변경]에 들어간다"로 고친다. task의 [변경]은 그 task의 시작 커밋부터라(D83) 리뷰가 고친 커밋은 review의 승인 화면에 보이고, verify의 승인 화면(Work 완료 화면)에는 기준 커밋부터의 [전체 변경]에 보인다. 설계는 바꾸지 않는다 | 계획의 문구가 D83과 어긋났음. verify의 [변경]에 앞 task의 커밋을 넣으면 task마다 [변경]의 뜻이 달라짐 | ✅ |
| I46 | 승인 대기에서 사람이 요청해 시작한 턴이 handoff를 다시 쓰지 않고 끝나도(Stop, 세션 종료, 재시작 조정), 앞 턴의 유효한 handoff로 승인 대기가 되고 [승인]이 켜진다 **(알려진 제약)**. `core/machine`의 `stop`, `sessionEnded`, `restarted`는 이번 턴에 handoff가 바뀌었는지 보지 않는다(`handoffChanged`는 형식 오류 되돌림에만 씀). 모든 단계에 원래 있던 동작인데, 리뷰는 고른 지적을 고치는 두 번째 턴을 늘 거친다. 리뷰에서 이렇게 된 채 승인하면 `decisions.md`에 고른 기록(D164)이 남지 않고, verify는 `반영`이 "없음"인 `review.md`를 읽는다. 승인하기 전에 승인 화면에서 `review.md`의 `반영` 절과 [변경]의 커밋이 맞는지 본다. 경고나 막음은 설계 9절의 추가 후보에 올린다 | 리뷰는 늘 수동 승인이라(D167) 승인 화면에 `반영` 절("없음")과 [변경]의 새 커밋이 함께 보여 사람이 어긋남을 알 수 있음. 모든 단계의 상태 기계를 바꾸는 일이라 M8 밖임. [실제] M·S에서는 두 번째 턴이 모두 `review.md`와 handoff를 다시 썼음(PR #13 리뷰) | ✅ |
| I47 | 스파이크 S7은 `spikes` 워크플로의 Linux 작업에서 돌린다(`spikes` 입력에 S7만 적을 때). Claude 인증 없이 시험용 레포 secret(I43)만 쓰고, 스파이크 의존성(node-pty)은 설치하지 않는다. 다른 계정의 코멘트는 사람이 달아야 하므로 start(시험 PR을 만들고 사람이 필요 없는 절차를 돌린 뒤 PR을 남김) → 사람의 코멘트 → finish(작성자 관계 읽기, 머지, 정리)로 나누고, 남은 것은 cleanup으로 치운다. 시험 PR은 main에서 만든 임시 기준 브랜치(`s7/<run>/base`)에 열어 시험용 레포의 main을 건드리지 않는다 | 웹 세션에서는 GraphQL이 막혀 gh의 PR 명령이 돌지 않음(`spikes.md` S7). 기존 Windows 작업은 Claude 인증부터 확인해 그대로 쓸 수 없음. 새 워크플로 파일은 기본 브랜치에 들어가기 전에는 수동 실행을 할 수 없는데, 기존 `spikes` 워크플로는 작업 브랜치를 ref로 줘 실행할 수 있음. 사람을 기다리며 러너를 붙잡지 않음. 임시 기준 브랜치를 지우면 머지한 시험 커밋도 남지 않음 | |
| I48 | PR 단계의 [실제]는 시험용 레포의 main에서 만든 임시 기준 브랜치(`m9/<run>/base`)를 Work의 기준 브랜치로 쓴다. PR의 머지와 충돌을 만드는 커밋은 그 브랜치에만 생기고, 시험이 끝나면 지운다 | 시험용 레포의 main을 건드리지 않음. 머지 커밋이 main에 쌓이지 않음. S7(I47)과 같은 방식(PR #14의 제안) | ✅ |
| I49 | M9의 [실제]는 가짜 `claude`와 실제 gh로 `app-claude` 워크플로의 Linux 작업(`pr`)에서 돌린다(`cases` 입력에 `pr`이나 `pr-cleanup`만 적을 때). Claude 인증 없이 시험용 레포 secret(`RELAY_TEST_GH_REPO`, `RELAY_TEST_GH_TOKEN`, I43)만 쓴다. 시험은 `test/claude/pr.test.ts`이고 `RELAY_REAL_GH=1`일 때만 돈다. 앱과 시험 도구의 git push는 gh의 자격 증명을 쓴다(S7과 같음). 도중에 멈춰 남은 시험 브랜치와 PR은 경우 `pr-cleanup`으로 치운다 | M9에는 에이전트가 없어 실제 `claude`가 필요 없고, Claude 인증 secret이 없는 레포에서도 돈다(8.4). 웹 세션에서는 GraphQL이 막혀 gh의 PR 명령이 돌지 않음(`spikes.md` S7). gh와 GitHub의 동작은 OS와 상관없고(S7), Windows에서 앱이 실제 gh를 부르는 길은 [실기]가 본다. 기존 워크플로에 작업을 더해 작업 브랜치를 ref로 줘 PR 전에도 돌림(I47) | |
| I50 | PR 진행의 gh 명령은 PR 주소(`https://<host>/<owner>/<repo>/pull/<n>`, `gh pr create`가 찍은 것이나 이미 열린 PR의 것)에서 읽은 레포로 부른다: gh 명령은 `--repo <host>/<owner>/<repo>`, REST는 `gh api --hostname <host> repos/<owner>/<repo>/…`이다 | PR 주소는 GitHub가 준 정식 주소라 origin 주소를 다시 읽을 필요가 없음. `gh api`는 호스트를 `--hostname`으로만 받고 `--repo`나 `GH_REPO`에서 읽지 않음(3절). 가짜 gh도 같은 모양의 주소를 줘 [흐름]이 같은 길을 지남 | |
| I51 | PR 읽기의 네트워크 부분(gh, git fetch)은 Work의 처리 줄 밖에서 하고, 결과의 반영(fast-forward, `pr-items.json`, `work.json`, 알림)만 처리 줄에서 한다. 한 Work의 읽기는 한 번에 하나이고, 끊긴 작업의 기록(D122)이 있는 동안은 자동으로 읽지 않는다 | 한 번 읽기가 gh를 네 번 이상 불러 몇 초 걸림(S7). 처리 줄에서 하면 그동안 사람의 조작과 (M10부터) 대응 task의 훅 응답이 기다림. 반영은 git과 파일을 바꾸므로 다른 조작과 섞이지 않게 줄에서 함. 끊긴 머지가 있는데 읽기가 Work를 끝내면 [다시 시도]·[무시]와 어긋남 | |
| I52 | Actions 실행의 이벤트(D201)는 WorkRunner가 실행 id별로 메모리에 두고, 처음 보는 실행만 `gh api --hostname <host> repos/<owner>/<repo>/actions/runs/<실행>?exclude_pull_requests=true`로 읽는다(한 번 읽기의 REST 목록 셋과 동시에). 앱을 켜면 CI 실패 항목에 적힌 이벤트로 먼저 채운다. 읽지 못하면 읽기의 경고로 보이고, 그 실행의 체크는 실행 id로 가려(`<워크플로>/<이름> #<실행>`) 다른 실행과 합치지 않으며, 다음 읽기에서 다시 읽는다 | 실행의 이벤트는 바뀌지 않아 한 번 읽으면 됨. 이벤트를 못 읽어도 PR 상태와 코멘트는 쓸모 있어 읽기 전체를 실패로 하지 않음. 합치면 실패를 가릴 수 있어 합치지 않는 쪽으로 틀림. CI 실패 항목에 적힌 이벤트를 쓰면 다시 켠 뒤 이벤트를 못 읽어도 항목의 id가 바뀌지 않음(바뀌면 해소됐다가 새 항목으로 돌아와 알림이 감). 처음 볼 때 이미 실패였고 그때 이벤트를 못 읽은 체크는 다음 읽기에서 항목의 id가 바뀐다(옛 항목은 해소됨). 머지 조건의 CI는 그동안에도 실패다 | |
| I53 | M10의 [실제]는 나눠서 돌린다. (1) 실제 `claude`와 가짜 gh: Claude Code 웹 세션의 Linux 컨테이너에서 경우 `respond`로 돈다. 대응 task가 항목에 대응하고 답글 초안을 쓰는지, 코멘트 속 지시를 따르지 않고 묻는지(D162) 본다. (2) 가짜 `claude`와 실제 gh: `app-claude`의 Linux 작업 `pr`에서 공통 시나리오(`test/flow/pr-scenario.ts`)에 더한 대응 단계로 돈다. 실제 GitHub에 push, 답글과 보이지 않는 표시, 다시 실행을 본다. 둘을 합친 [실제](실제 `claude`의 답글이 실제 GitHub에 올라감)는 레포에 Claude 인증 secret을 넣거나 사람의 PC에서 돌릴 수 있을 때 한다. 그때까지 M10의 [실제]는 일부만 채운 것으로 적는다 | 웹 세션은 GitHub API가 막혀 gh를 쓸 수 없음(S7. 2026-09-29에도 REST와 GraphQL 모두 403). 레포에는 Claude 인증 secret이 없고, 사람은 지금 PC를 쓸 수 없음. `claude setup-token`은 터미널 명령이라 휴대폰에서 할 수 없음. 나누면 지금 secret 없이 두 쪽을 모두 돌리고 고칠 수 있음 | ✅ |
| I54 | `app-ci`의 Windows [흐름]을 두 작업으로 나눠 나란히 돌린다: PR 진행과 대응 시험(`test/flow/pr*.test.ts`)과 나머지다. 빌드(I39)와 [어댑터]는 나머지 작업에만 둔다. 각 작업의 제한은 20분 그대로다 | M9 끝에 Windows 작업이 약 15~16분으로 제한(20분)에 가까웠고(push와 pull_request 실행이 함께 돌면 더 늘어남), M10의 [흐름]이 1.5~3분쯤 더함. 공개 레포라 러너 시간은 무료이고, 나누면 기다리는 시간도 줄어듦 | ✅ |

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
| GitHub 연동 | PR 진행(M9~M11)이 쓰는 gh와 GitHub의 동작(PR 상태, 체크와 실패 로그, 코멘트의 작성자, 답글과 표시, 재실행, 충돌, 원격 PR 브랜치, 머지, API 한도)은 `docs/spikes.md`의 S7 결과를 따른다(gh 2.101.0). 협업자와 협업자가 아닌 계정의 작성자 관계는 아직 확인하지 않았다 | `docs/spikes.md` S7 (2026-09-29) |
| gh의 체크 분류 | `gh pr checks`는 체크의 상태(StatusContext는 `state`, CheckRun은 끝났으면 `conclusion` 아니면 `status`)를 SUCCESS는 pass, SKIPPED·NEUTRAL은 skipping, ERROR·FAILURE·TIMED_OUT·ACTION_REQUIRED는 fail, CANCELLED는 cancel, 나머지(EXPECTED, REQUESTED, WAITING, QUEUED, PENDING, IN_PROGRESS, STALE)는 pending으로 나눈다. 같은 체크가 여러 번 돌았으면 시작 시각이 가장 늦은 것만 남긴다(StatusContext는 context, CheckRun은 이름·워크플로·이벤트로 가림) | cli/cli v2.101.0 `pkg/cmd/pr/checks/aggregate.go` (2026-09-29) |
| `gh pr view --json statusCheckRollup` | PR의 마지막 커밋(`commits(last: 1)`)의 체크 가운데 처음 100개다. CheckRun은 `__typename`, `name`, `workflowName`, `status`, `conclusion`, `startedAt`, `completedAt`, `detailsUrl`을, StatusContext는 `__typename`, `context`, `state`, `targetUrl`, `startedAt`(만든 때)을 준다. 커밋 노드가 없으면 null이다. `mergeCommit`은 `{oid}`다 | cli/cli v2.101.0 `api/query_builder.go`, `api/export_pr.go` (2026-09-29) |
| `gh run view --log-failed` | `--job`을 줘도 그 작업과 실행(run) 전체가 끝나야 로그를 준다. 아니면 "run <id> is still in progress; logs will be available when it is complete"(작업이면 "job <id> …")로 실패한다. 줄마다 `<작업 이름>\t<스텝 이름>\t`을 앞에 붙이고, 로그의 제어 문자는 `^[` 꼴의 글자로 바꾼다 | cli/cli v2.101.0 `pkg/cmd/run/view/view.go` (2026-09-29) |
| `gh pr merge` | 머지하기 전에 PR의 mergeStateStatus가 BLOCKED, BEHIND, DIRTY면 GitHub에 머지를 요청하지 않고 "Pull request <레포>#<n> is not mergeable: …"를 stderr에 쓰고 종료 코드 1로 끝난다(`--admin`, `--auto`를 빼면). 이미 머지된 PR이면 아무것도 하지 않고 성공한다. `--match-head-commit`은 GraphQL `mergePullRequest`의 `expectedHeadOid`로 보낸다. 진행 문구는 표준 출력이 TTY일 때만 쓴다. `--delete-branch`가 없으면 로컬 브랜치를 건드리지 않는다 | cli/cli v2.101.0 `pkg/cmd/pr/merge/merge.go`, `http.go` (2026-09-29), S7 |
| `gh api`의 호스트 | 요청 호스트는 gh 설정의 기본 호스트이고 `--hostname`으로만 바꾼다. `GH_REPO`에서는 `{owner}`, `{repo}` 자리 표시자만 채운다. `--slurp`는 `--paginate`와 함께 써야 하고 모든 쪽의 JSON 배열을 한 배열로 싼다 | cli/cli v2.101.0 `pkg/cmd/api/api.go` (2026-09-29) |
| Actions 실행의 이벤트 | REST `GET /repos/{owner}/{repo}/actions/runs/{run_id}`(Get a workflow run)는 실행을 부른 이벤트를 필수 필드 `event`(문자열, 예 `push`)로 준다. `exclude_pull_requests`를 받는다. 레포를 읽을 수 있으면 부를 수 있다(비공개 레포는 OAuth·classic 토큰에 `repo` 범위). `gh run view`도 같은 경로를 `exclude_pull_requests=true`로 읽는다. `gh pr view --json statusCheckRollup`의 CheckRun에는 이벤트가 없다(위). 이 레포의 app-ci는 PR이 열린 브랜치에 코드를 push하면 push와 pull_request로 실행이 둘 생겨 같은 커밋에 체크가 두 벌 붙는다(f7781ce: 실행 #96 push, #97 pull_request) | GitHub REST API 설명 `github/rest-api-description`의 api.github.com.json 1.1.4(`actions/get-workflow-run`), cli/cli v2.101.0 `pkg/cmd/run/shared/shared.go`, 이 레포의 Actions 실행 목록 (2026-09-29) |
| 옛 head로 머지할 때 GitHub의 거절 | 머지 창에 보인 head 뒤에 새 커밋이 생긴 직후 `--match-head-commit <옛 head>`로 머지하면 GitHub가 "Head branch was modified"가 아니라 "GraphQL: Pull Request is not mergeable (mergePullRequest)"로 거절할 수 있다(새 head의 머지 가능 여부를 계산하는 중). 어느 쪽이든 머지하지 않는다. S7에서는 "Head branch was modified"를 봤다. 앱은 거절 문구에 기대지 않고 PR의 head를 다시 읽어 가른다 | M9 [실제] `app-claude` 실행 #2(2026-09-29, 새 커밋은 contents API로 넣음), S7 |
| REST 답글과 대화 코멘트 | "Create a reply for a review comment"(`POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`, 본문 `body` 필수)는 `comment_id`에 스레드의 첫 리뷰 코멘트(top-level) id를 받는다. 답글의 답글은 받지 않는다. 응답은 201, 404다. "Create an issue comment"(`POST /repos/{owner}/{repo}/issues/{issue_number}/comments`)는 PR에도 쓰며 응답은 201, 403, 404, 410, 422다. 두 요청 모두 알림을 보내고, 너무 빨리 만들면 보조 한도에 걸릴 수 있다 | GitHub REST API 설명 `github/rest-api-description`의 api.github.com.json 1.1.4(`pulls/create-reply-for-review-comment`, `issues/create-comment`) (2026-09-29), S7 관찰 4 |
| 실패한 작업 다시 실행 | REST "Re-run failed jobs from a workflow run"(`POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs`)은 실행의 실패한 작업과 그 작업에 딸린 작업을 다시 돌리고 201을 준다. `gh run rerun <실행> --failed`는 실행을 읽은 뒤 이 요청을 보내고, 403이면 "run <id> cannot be rerun; <메시지>"로 실패한다. 성공 문구는 표준 출력이 TTY일 때만 쓴다 | api.github.com.json 1.1.4(`actions/re-run-workflow-failed-jobs`), cli/cli v2.101.0 `pkg/cmd/run/rerun/rerun.go` (2026-09-29), S7 관찰 5 |
| `gh api`의 본문과 오류 | `--input <파일>`은 요청 본문을 파일에서 읽고 `-`면 표준 입력에서 읽는다. 응답이 HTTP 400 이상이면 응답 본문을 표준 출력에 찍고 "gh: <메시지> (HTTP <코드>)"를 stderr에 쓴 뒤 종료 코드 1로 끝난다. 그래서 게시 요청이 실패로 끝나도 GitHub가 받았는지는 gh의 결과로 알 수 없다(연결이 끊긴 5xx 등) | cli/cli v2.101.0 `pkg/cmd/api/api.go` (2026-09-29) |
| gh 버전과 플래그 | `gh api --slurp`는 v2.48.0에, `gh pr merge --match-head-commit`은 v2.13.0에 생겼다. `gh run view --log-failed`는 v2.0.0에 있다. M9가 쓰는 `gh pr view --json`의 필드(number, url, state, isDraft, headRefName, headRefOid, baseRefName, mergeable, mergeStateStatus, reviewDecision, statusCheckRollup, mergedAt, mergeCommit), `gh repo view --json`의 머지 방식 셋, `gh run view --job`, `gh api --hostname`은 v2.48.0에 모두 있다. `gh --version`의 첫 줄은 `gh version <버전> (<빌드 날짜>)`다 | cli/cli 태그별 소스(`pkg/cmd/api/api.go`, `pkg/cmd/pr/merge/merge.go`, `pkg/cmd/run/view/view.go`, `api/query_builder.go`, `api/queries_repo.go`, `api/export_pr.go`, `pkg/cmd/version/version.go`) (2026-09-29) |
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
| Windows에서 앱이 죽은 뒤의 PTY | ConPTY DLL 모드(I32)에서 앱 역할 프로세스를 강제 종료하면 PTY 안의 트리(node와 그 자식)는 3초 안에 함께 끝났다(S1의 내장 ConPTY와 같음). `detached`로 띄운 프로세스(자기 콘솔, `conhost.exe`)는 남았다 | [어댑터] 고아 프로세스 시험, app-ci #42·#44·#45(windows-2025-vs2026 20260922.246.2) (2026-09-27) |
| worktree의 prune과 remove | `prune`은 작업 트리가 없어진 worktree의 `$GIT_DIR/worktrees` 정보를 지운다. `remove`는 깨끗한 worktree(추적하지 않는 파일과 추적 파일의 수정이 없음)만 지우고 아니면 `--force`가 필요하다. git 2.43.0과 2.55.0.windows.5에서 `.git` 파일이 없어진 worktree는 `--force`로도 지우지 않았고(목록에는 prunable로 남음), prune은 관리 정보만 지우고 폴더는 남겼다. 지운 추적 파일도 수정으로 보아 `--force`가 있어야 지웠다. `worktree list --porcelain`은 Windows에서도 경로를 `/`로 찍었다 | git 문서 git-worktree, 실행(Linux 컨테이너, app-ci #45) (2026-09-27) |
| stash 목록 | `git stash list`는 `git log`의 형식 옵션을 받는다. `--message`로 만든 항목의 제목(`%gs`)은 `On <브랜치>: <메시지>`였다(2.43.0, 2.55.0.windows.5) | git 문서 git-stash, 실행 (2026-09-27) |
| 없는 브랜치가 섞인 `git branch -D` | 있는 브랜치는 지우고 종료 코드 1로 끝났다(2.43.0, 2.55.0.windows.5) | 실행 (2026-09-27) |
| `TextDecoder`의 stream | `decode(input, { stream: true })`는 끝의 덜 끝난 바이트 열을 안에 두고 다음 호출 때 내보낸다. 한 번만 부르면 잘린 글자는 나오지 않는다 | Node 문서 util `textDecoder.decode` (2026-09-27) |
| 턴의 훅 | 턴마다 오는 훅은 UserPromptSubmit, Stop, StopFailure다. UserPromptSubmit은 사람이 프롬프트를 제출할 때 Claude가 처리하기 전에 온다. Stop은 Claude가 응답을 마칠 때 오고, 사람이 Esc로 끊으면 오지 않으며, API 오류로 끝나면 StopFailure가 대신 온다. 자동 이벤트(아래 완료 알림)로 시작한 턴에 UserPromptSubmit이 오는지는 문서에 없다 | Claude Code 문서 hooks (2026-09-27) |
| Stop의 백그라운드 작업 | Stop 본문에는 `background_tasks`(도는 셸, 서브에이전트 등)와 `session_crons`(`/loop`, `CronCreate`, `ScheduleWakeup`의 예약된 깨우기)가 있어, "세션이 끝남"과 "백그라운드 작업이 다시 깨우기를 기다리며 쉬는 중"을 가른다. task 목록을 읽을 수 있으면 늘 있고 없으면 빈 배열이다. 2.1.145에서 더해졌다 | Claude Code 문서 hooks, changelog (2026-09-27) |
| 백그라운드 서브에이전트 | 대화형 세션은 fork 모드가 기본으로 켜져 있어 Claude가 띄운 서브에이전트를 백그라운드에서 돌린다. 그 결과는 나중 턴에 완료 알림으로 오고, 알림은 사람의 메시지가 아니라 자동 이벤트로 표시된다. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`이면 포그라운드에서 돌린다. 백그라운드 셸은 Claude Code가 끝날 때 함께 정리된다 | Claude Code 문서 sub-agents, interactive-mode (2026-09-27) |

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
| core | `pipeline` | 노드 순서, 크기별 경로와 고를 수 있는 단계(D147, D149), 모든 크기가 지나는 리뷰(D163, D166), 선택 가능한 다음 단계, 기본 다음 단계 | 3.1, 3.2, 3.4 |
| core | `machine` | Work와 Task 상태 전이. `(상태, 이벤트) → (새 상태, 할 일)` (I10) | 3.3, 시나리오 3~5 |
| core | `validate` | handoff와 intent 초안의 머리글 파싱, 스키마 검사, 추가 검사(`pr.md`, PR 대응의 `replies.md`, D190), 되돌림 메시지 | 5.2.1, D107 |
| core | `context` | `context.md` 조립(입력: 상태, intent, 결정 로그, 누적 기각 목록, 직전 handoff, PR 대응의 항목과 PR 정보 D192), 마무리 안내 문구(D104) | 시나리오 2-4 |
| core | `settings` | task 설정 파일 내용(훅, deny 규칙) 만들기, 실행 인자 만들기 | 시나리오 2-3·2-5, 6절 |
| core | `approval` | 자동 승인의 방식과 조건 판정, 배지 우선순위 | 4.2, 4.3, D80, D129 |
| core | `rewind` | 단계 선택의 결과 계산(폐기할 task, 되돌릴 커밋, 건너뛸 단계, 백업 브랜치 이름), 대화상자의 단계와 미리 보기 | 6.2, 6.3, D82, D115~D117 |
| core | `delivery` | 전달 버튼과 그 이유, 전달을 시작할 수 있는지, `pr.md`의 제목과 본문, 비교 URL과 gh의 레포, 커밋 안 된 변경의 커밋·stash 메시지 | 시나리오 7, D62, D67, D71, D118~D120 |
| core | `cleanup` | 정리할 수 있는 Work, 확인 요약과 기본 선택, 지울 브랜치와 `--force`, 머지한 Work의 원격 브랜치 삭제(D178) | 시나리오 8, D16 |
| core | `pr` | PR 진행: PR 주소의 레포(I50), 체크 분류와 CI 상태(D196), 코멘트의 거르기(D160, D161, D197), 항목의 모음과 상태(D189, D199), 머지 조건(D176), 배지(D183), 원격 head 비교(D193), 실패 로그의 끝부분, 기본 머지 방식(D177), gh 버전(D198), PR 패널의 모양(대응 라운드 기록, 다시 실행) | 시나리오 10 |
| core | `respond` | PR 대응: [대응 시작]을 받는지(D170, D182), 라운드와 항목의 대응 중·처리됨(D189), 게시할 답글의 본문과 보이지 않는 표시(D173, D194, D207), 앱이 게시한 답글 가리기, 건너뛸 답글(D205), 기존 테스트 변경(D202), 다시 실행할 실행(D203), 판정표 경고(D206) | 시나리오 10-3~10-8 |
| adapters | `store` | RELAY_HOME 경로, 원자적 쓰기, 앱 소유 파일 해시, `events.jsonl`, `decisions.md` | 5.1, 5.4, 5.5, D91 |
| adapters | `pty` | node-pty 세션, `pty.log` 기록, 프로세스 트리 종료, 프로세스 ID와 시작 시각 | S1, D76 |
| adapters | `hooks` | 훅 HTTP 서버, 토큰 확인, Stop 응답 (I13) | S2, D20, D21 |
| adapters | `git`, `gh` | worktree, status, diff와 바뀐 파일 목록, reset, 백업 브랜치, push, stash, 커밋, worktree와 브랜치 지우기, fetch와 fast-forward, 원격 브랜치 지우기, `gh auth status`, `gh --version`, `gh pr`(list, create, view, merge), `gh api`(코멘트 목록, 답글 POST), `gh run view`, `gh run rerun`, `gh repo view` (I12) | 시나리오 1·6·7·8·10 |
| adapters | `watch` | task 디렉터리 감시 (I15) | 시나리오 3-3 |
| adapters | `claude` | 실행 파일 찾기(D106), `claude auth status`, 버전 기록(D105), 이번 task의 스킬 배포(D103, D108) | 시나리오 0, 2-2, 5.6.3 |
| main | `app` | 시작 때 재시작 조정(시나리오 9), 종료 확인 | 시나리오 3-6, 9 |
| main | `runner` | 할 일 실행: task 시작·종료, 세션 상한 대기열, 되감기, 전달과 정리 세션, 정리, 자동 승인 카운트다운의 타이머, PR 읽기의 타이머와 머지(I51), PR 대응의 시작과 push·답글 게시, 다시 실행 | 시나리오 2, 4.3, 5~8, 10, D18, D127 |
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
| npm `.cmd`를 `cmd.exe /d /s /c`로 감싸 실행, `useConpty: true`, `xterm-256color`. 앱은 `useConptyDll: true`를 더한다(I32). 경로의 공백과 특수 문자는 다루지 않는다(D141) | `spikes/lib/session.mjs` `start` | `adapters/pty` |
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
- 설계 v0.5의 확장은 M8 → M9 → M10 → M11 차례다(I41). M9 전에 스파이크 S7을 돌린다(I42).
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
| M8 | 리뷰 단계 | fix와 verify 사이의 리뷰 노드와 스킬(D163~D167) | |
| M9 | PR 진행 | PR 진행 상태, 읽기, 항목 보기, 머지, 머지 뒤 정리. 에이전트 없음 | 스파이크 S7(I42) |
| M10 | PR 대응 | 사람이 누르는 [대응 시작], PR 대응 task, 승인 뒤 push와 답글, CI 재실행 | |
| M11 | 자동 대응 | 대응 자동 시작과 자동 승인, 라운드 상한 | |

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
- **진행 중 작업 기록(D77):** 코드를 되돌리는 되감기만 기록한다. 세션을 끝내며 `operation`(kind `rewind`, stage `backup`)을 적고, 백업 브랜치를 만들면 stage를 `reset`으로 바꾸고, 되돌린 뒤 폐기와 새 task를 쓰는 `work.json` 한 번 쓰기에서 지운다. 코드를 건드리지 않는 선택(건너뛰기, [현재 코드 위에서 이어서])은 `work.json` 한 번 쓰기로 끝나 끊길 곳이 없어 기록하지 않는다. git이 실패하면 [단계 선택]의 결과와 Work의 문제로 알리고 기록을 지운다. 다만 코드를 되돌리다 실패했는데 코드가 이미 바뀌었으면 기록을 끊긴 되감기로 남긴다(D136, I36). 끝낸 세션은 끝난 채로 두고(승인 대기였으면 승인 대기로 남아 승인할 수 있음), 만든 백업 브랜치는 남는다. 재시작 때 남은 기록은 그대로 둔다(알림은 M6).
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
- **정리 세션([AI 세션 열기], 7-5):** verify 세션을 끝내고 worktree에서 새 Claude Code 세션을 연다. 기록하지 않는 일반 터미널이라 task를 만들지 않고, 세션 id, 스킬, 첫 프롬프트, `context.md`가 없다. 설정 파일에는 task와 같은 deny 규칙(push와 PR, 이전 task 디렉터리, D17), 자동 메모리 끔(D113), 훅(`/hook/cleanup/<Event>`, 토큰은 세션마다)을 넣는다. 세션 상한(D18)을 따라 자리가 없으면 대기열에서 기다린다. 탭 이름은 "정리 세션"이고, 다시 열면 새 탭이다. 턴이 끝날 때(Stop)마다 `git status`를 보고 깨끗하면 [정리 끝 → push/PR 진행]을 강조하고, 사람이 새 요청을 보내면 강조를 끈다. 버튼을 누르거나 세션이 끝나면(`/exit`) `git status`가 깨끗할 때만 원래 고른 전달을 하고, 변경이 남았으면 선택지로 돌아간다. 정리 세션이 열려 있는 동안 전달 버튼은 막는다. D137의 나머지 조작도 main이 막고(`WorkRunner`의 명령이 정리 세션을 보고 거부), 화면의 조작은 `cleanupActions`(core/delivery)로 끈다. [정리 세션 닫기]는 정리 세션을 끝내고(대기열이면 뺀다) 치운다. 정리 세션 중에 [이 단계 끝나면 멈춤]을 켜 Work 완료 화면이 [승인하고 멈춤]이 되어도 정리 세션의 안내와 [정리 세션 닫기]를 보인다. 정리 세션이 열린 동안은 [승인하고 멈춤]을 끄고, 승인하면 멈추는 동안은 전달하지 않으므로(`deliveryStart`) [정리 끝 → push/PR 진행]도 끈다(PR #10 리뷰). 앱을 끝낼 때 정리 세션도 끝내고(종료 확인에 셈), 재시작 뒤에는 남지 않는다.
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

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. 설계를 바꾼 것은 D127~D132다)

- **카운트다운의 기록(D127):** task 기록의 `countdown`은 시작한 때(Stop을 받은 때)와 초다. 자동 승인하지 않은 까닭은 `auto_hold`(때, 까닭)에 적어 승인 화면에 보인다. 둘 다 승인 대기인 task에만 있고, task가 승인 대기를 벗어나면(작업 중, 승인됨, 폐기됨, 중단됨) 지운다. 새 요청(UserPromptSubmit)으로 작업 중이 되면 이렇게 카운트다운이 멈춘다.
- **타이머:** main이 `setTimeout`으로 돈다. core의 전이가 카운트다운을 걸거나 풀면 할 일(`startCountdown`, `stopCountdown`)로 알린다. 끝나면 main이 파일을 다시 읽어 검사하고 core에 넘긴다(`autoApprove`). 멈췄거나 새로 시작한 카운트다운의 늦은 타이머는 시작 시각이 달라 무시한다. 한 Work의 카운트다운은 지금 task 하나뿐이다. 화면의 남은 초는 main이 스냅샷으로 보낸 끝나는 때(ms)로 렌더러가 센다. 앱을 끝낼 때 타이머를 푼다.
- **판정(4.3, D128, D129):** 조건은 core/approval의 `autoApproveHolds`가 본다. 기본 다음 단계는 승인된 intent의 크기로 정한다(S 경로 fix의 기본 다음 단계는 verify). `background_tasks`와 `session_crons`는 Stop 본문의 배열이고, 배열이 아니거나 없으면 비어 있는 것으로 본다. 형식 경고(D85, 분량)와 커밋 안 된 변경은 조건이 아니다(D7, 승인 화면의 경고). 되돌림에 이어진 턴(`stop_hook_active: true`)도 턴이 끝난 것이라 판정한다. 끊긴 작업의 기록이 있으면 카운트다운하지 않고 승인하지 않는다(D122). 기록이 있는 동안은 세션을 열 수 없어 실제로는 Stop이 오지 않는다.
- **승인의 기록:** 자동 승인은 사람 승인과 같은 전이로 `approved_by: auto`, `task.approved`의 `payload.by: auto`, `decisions.md` 머리 줄의 "(자동 승인)"을 남긴다. `decisions.md`는 사람 승인과 같은 길로 덧붙이고 해시를 적는다(D124). 카운트다운 중에 사람이 [승인]하면 사람 승인이다. [이 단계 끝나면 멈춤]이 켜져 있으면 자동 승인한 뒤 멈춘다(3-4). 세션은 사람 승인처럼 끝내고 다음 task를 시작한다(시나리오 5).
- **이벤트(5.5):** 카운트다운의 시작과 멈춤은 `events.jsonl`에 남기지 않는다. 5.5에 없는 유형은 더하지 않았다. 멈춘 까닭은 다음 Stop까지 `work.json`에 남는다.
- **알림(D81, D130):** 카운트다운을 시작하면 "<task>: <n>초 뒤 자동 승인 (멈추려면 [취소])"를 알린다. 승인 대기로 바뀌는 알림 대신이다. 새 요청 없이 턴이 다시 끝나 새로 시작해도 알린다. 켜진 단계에서 조건을 어겨 카운트다운하지 않거나, 세션 종료나 조건 어김으로 멈추면 "<task>: 승인 대기 — 자동 승인하지 않음(<까닭>)"을 알린다. [취소], [즉시 중단], 확인 창으로 앱을 끈 것, [단계 선택](D145), 설정을 끈 것과 재시작 조정은 알리지 않는다. 보고 있는 Work면 창이 가린다(M3).
- **설정(D70, D72):** 설정 화면에서 단계별 자동 승인(evidence, rca, fix)과 카운트다운(1~3600초)을 바꾼다. intake나 verify를 켜는 값은 받지 않고, `config.json`에 있으면 경고하고 기본값을 쓴다. Work별 자동 승인은 새 Work 대화상자와 [Work 설정]에서 단계마다 "앱 설정 따름 / 켜기 / 끄기"로 고른다. Work 설정은 준 키만 바꾸고, 빈 값이면 그 키를 `settings`에서 빼 앱 설정을 따른다. 카운트다운 초는 Work별 덮어쓰기가 없다(5.1.1). 앱 설정을 바꾸면 모든 Work에 알려 카운트다운 중에 끈 단계를 멈춘다. 상태가 그대로인 Work에도 스냅샷을 다시 보낸다. 승인 화면의 자동 승인 안내는 설정으로 정하는데, 화면은 스냅샷이 바뀔 때만 다시 읽기 때문이다(PR #9 리뷰).
- **화면(D83):** 승인 화면의 [승인] 위에 "자동 승인까지 n초"와 [취소]를 보인다. 켜진 단계의 승인 대기인데 카운트다운하지 않으면 까닭과 "다음 턴이 끝날 때 다시 판정합니다"를 보인다. 까닭이 적혀 있지 않으면 자동 승인을 켜기 전에 턴이 끝난 것이다(D128). 사이드바 배지는 승인 대기 그대로다(D80).
- **재시작(D75, D127):** 조정은 카운트다운을 지운다. 카운트다운 중이었거나 조정으로 승인 대기가 된 task(자동 승인이 켜진 단계)는 까닭을 "재시작"으로 적는다. 이것은 앱이 충돌해 카운트다운이 남은 경우다. 확인 창으로 끄면 끌 때 세션을 끝내며 카운트다운을 멈추고 까닭을 "카운트다운 중에 앱을 끔"으로 적어, 조정은 까닭을 바꾸지 않는다(D145). 세션을 끝내 멈춘 까닭은 core/machine의 `endHold`가 `task.interrupted`의 reason(human, app_quit, rewind·skip)에서 정한다. [세션 재개]로 다시 연 세션은 Stop이 없어 판정하지 않고, 사람이 요청해 턴이 끝나면 판정한다(D131).
- **알려진 한계:** 자동 이벤트(백그라운드 작업의 완료 알림 등)로 시작한 턴에 UserPromptSubmit이 오는지는 문서에 없다(3절). 오지 않으면 카운트다운 중에 그런 턴이 시작돼도 앱은 Stop 전까지 모른다. Stop 때 백그라운드 작업과 예약된 깨우기가 없었을 때만 카운트다운하므로(D129) 드물고, 그 턴이 handoff를 바꾸면 감시가 다시 판정하며(D130), 카운트다운이 끝날 때도 다시 읽어 판정한다. 터미널에 글자를 치는 것(Enter 전)은 새 요청이 아니라 카운트다운을 멈추지 않는다. 길게 말할 때는 [취소]를 먼저 누른다.
- **Linux의 10초:** 자동 승인도 세션을 끝내고 다음 task로 가므로 Linux에서 10초 늦다(3절).

### M8. 리뷰 단계

**내용**

- `core/pipeline`의 `steps`와 `route`(I40)에 노드 `review`를 fix와 verify 사이에 더한다(D166, D187). 모든 크기(S, M, L)가 거친다(D163). 선택 가능한 다음 단계(3.2)와 되감기 계산(6.2, D117)이 따라 바뀐다.
- 스킬 `skills/review/SKILL.md`(설계 5.6.10)를 쓰고 `skills/check.mjs`의 대상에 더한다. 크기 목표(D31) 안에 둔다.
- 리뷰는 자동 승인을 켤 수 없다(D167). `config.json`의 `auto_approve`에 항목이 없고, `question_mode`에 `review`를 더한다.
- `context.md`의 마무리 안내 문구(설계 시나리오 2-4의 review 줄), 화면 이름 "리뷰"(D109, D187), 필수 산출물 `review.md`(3.1, D30).
- verify의 입력에 `review.md`(경로)가 더해진다(설계 5.6.8). `skills/final-verify/SKILL.md`를 맞춘다.

**완료 기준**

- [단위] 선택 가능한 다음 단계와 되감기 계산에 review가 들어간다. 리뷰에 자동 승인을 켜는 값은 받지 않는다.
- [흐름] 가짜 `claude`로 M 경로와 S 경로가 review를 거쳐 Work 완료까지 간다. review에서 만든 커밋이 review의 [변경]과 Work 완료 화면의 [전체 변경]에 들어간다(I45).
- [실제] 실제 `claude`로 review가 지적을 번호 붙인 목록으로 쓰고, 사람 역할이 번호로 지시한 지적만 고쳐 커밋하고, 지시하지 않은 지적은 그대로 둔다(D164).

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. PR #13 리뷰로 설계 결정 D195를 더하고, 5.6.10의 입력 문구를 점검 A33에 맞췄다)

- **경로(I44):** S는 intake → fix → review → verify, M은 intake → investigate → fix → review → verify, L은 intake → evidence → rca → fix → review → verify다. fix의 기본 다음 단계는 review이고, verify의 이전 단계에 review가 든다. 단계 선택에서 review로 되감으면 review부터 폐기하고 review의 시작 커밋으로 되돌린다. fix로 되감으면 리뷰가 고친 커밋도 되돌리고(D117), [현재 코드 위에서 이어서]는 전처럼 fix만 준다. fix를 마친 뒤 verify를 고르면 review를 건너뛴 건너뛰기로 기록한다.
- **스킬:** `skills/review/SKILL.md`는 설계 5.6.10을 따른다. 입력은 `context.md`, `fix.md`, 기준 커밋부터의 `git diff`와, `context.md`에 있으면 `rca.md`다. `rca.md`는 `context.md`에 없을 때만(보통 S 경로) 건너뛰고, 있으면 크기와 관계없이 읽는다. S Work가 investigate로 되돌아갔다 오면 있기 때문이다(점검 A33과 같음, PR #13 리뷰). `context.md`에 있으면 재현 절차가 적힌 `evidence.md`도 읽고(S 경로는 `fix.md`의 `원인과 재현`), 재현 절차가 쓰는 코드는 쓰지 않는 코드로 보지 않는다(D195). 1) 지적을 `## 지적`에 번호 붙여 쓰고 마무리한다. 이때 `## 반영`은 "없음", `## 반영하지 않은 지적`은 모든 번호다. 2) 사람이 번호로 고르면 그것만 고쳐 커밋하고 테스트 명령을 돌려 두 절을 채운 뒤 다시 마무리한다. 재현 절차가 쓰는 코드는 바꾸지 않고, 바꿔야 하면 달라진 재현 절차를 `반영` 절에 적는다(D195). 3) 고르지 않은 지적은 작아도 고치지 않는다. 고르는 것은 질문 규칙의 예외라 `AskUserQuestion`으로 묻지 않고, 고른 것과 고르지 않은 것을 `decisions`에 `by: human`으로 남긴다. 합친 크기는 약 1,980토큰(Claude Code 어림)으로 D31의 목표 안이다. 앱은 다른 스킬과 같이 `relay-review`로 배포하고(D103), `skills/check.mjs`가 5.6.10의 규칙과 템플릿을 본다.
- **fix와 final-verify 스킬:** fix 스킬이 자신을 코드를 바꾸는 유일한 단계라고 한 문장을 설계 5.6.7(v0.5)대로 주 단계로 고쳤다(리뷰도 사람이 고른 지적은 고친다). final-verify의 입력에 `review.md`(필요하면)와 "리뷰가 고친 것은 `반영` 절"을 더했다(5.6.8). `반영` 절에 달라진 재현 절차가 있으면 그 절차로 재현한다(D195). verify의 `context.md`는 이전 task의 산출물 목록에 `review.md` 경로를 넣는다.
- **마무리 안내 문구(시나리오 2-4):** review의 `context.md`는 "리뷰를 썼습니다. 반영할 지적은 번호로 여기에 말해 주세요. 반영할 것이 없거나 반영을 마쳤으면 오른쪽 패널에서 확인하고 [승인]을 누르세요."를 쓴다. 자동 승인 절은 "수동 승인 (의도 승인, 리뷰, Work 완료는 늘 수동)"이다.
- **승인 화면(D83, I45):** review의 [변경]은 review의 시작 커밋부터라 리뷰가 고친 커밋이 여기에 보인다. verify의 [변경]에는 없고, Work 완료 화면의 [전체 변경]에 수정과 함께 보인다. 필수 산출물은 `review.md`이고(D30) 절 검사는 없다. 사람이 지시하면 승인 대기에서 작업 중이 되고, 다시 마무리하면 승인 대기가 된다(시나리오 4-3). 다시 쓰지 않고 턴이 끝나도 앞 handoff로 승인 대기가 된다(I46, 알려진 제약).
- **설정(D167):** `question_mode.review`의 기본은 `draft_first`다. `config.json`에 없으면 경고 없이 기본값을 쓴다(5.1.1). 설정 화면에는 리뷰의 질문 방식만 있고 자동 승인 목록에는 없으며, 안내는 "의도 정리, 리뷰, 최종 검증은 늘 수동입니다."다.
- **진행 중인 Work(I44):** fix를 승인하기 전의 Work는 fix 다음에 review를 지난다. [이 단계 끝나면 멈춤]으로 fix 승인 뒤 멈춘 Work도 [재개]하면 review로 간다. 이미 verify가 생긴 Work는 review 없이 끝나므로, 리뷰를 거치려면 verify에서 [단계 선택]으로 review를 고른다.
- **시험:** [흐름]은 시험 도구(`test/flow/driver.ts`)에 `instruct`를 더해, 승인 대기가 된 task에 사람이 터미널로 지시하는 것을 흉내 낸다. 가짜 `claude`의 리뷰 시나리오(`reviewInstructed`)는 지적 둘을 쓰고 마무리한 뒤, 새 요청을 받으면 1번만 고쳐 커밋하고 다시 마무리한다. [실제]의 사람 역할과 판정은 8.4에 있다.

### M9. PR 진행

**내용**

- Work 상태 "PR 진행"(D152). [PR 생성]이 성공하면 완료 대신 PR 진행이 된다(D120, D156).
- `adapters/gh`: PR 상태, head 커밋, 체크 상태와 실패 로그, 리뷰와 코멘트, 머지 가능 여부 읽기, 머지. 방법은 S7의 결과를 따른다.
- 읽기(D153, D158, D159), 항목과 거르기(D157, D160, D161, D189), 원격 PR 브랜치 맞추기(fast-forward와 갈라짐 항목, D193), `work.json`의 `pr`과 `pr-items.json`(D191), deny 규칙에 `pr-items.json`.
- PR 패널, [새로 고침], 배지(D183), 알림(D184), 머지 창과 머지(D176, D177), 머지 뒤 정리 창(D178), 밖에서 머지·닫힘(D179), [머지 없이 끝내기], 프로젝트 설정 화면(D185).
- 이 마일스톤에는 PR 대응 task가 없다. 항목은 보이기만 한다. 머지 조건은 "제외하지 않은 받은 항목이 모두 처리됨"이므로(D176) 사람이 [제외]해서 채운다. CI 실패와 충돌은 제외해도 머지를 막으므로, 사람이 relay 밖에서 고쳐 push하면 앱이 받는다(D193). 조건이 없어진 것을 읽으면 그 항목은 해소됨이다(D199).
- gh 버전(D198): 등록 점검과 다시 점검(D67, D118)이 `gh --version`도 보고 2.48.0보다 낮으면 [PR 생성]을 끈다. PR 진행을 시작할 때 버전을 `work.json`의 `pr`에 적는다. 확인한 버전(2.101.0)과 다르기만 하면 알리지 않는다.
- 머지 뒤 정리 창(D178, D200): [머지]로 머지했으면 바로 열고, 밖에서 머지된 것을 읽었으면 그 Work를 볼 때 한 번 연다.
- 새 설정: `config.json`의 `pr_poll_interval_sec`(D158), `project.json`의 `allowed_bots`와 `merge_method`(5.1.2).

**gh와 git으로 하는 일** (S7의 결과와 PR #14의 "M9에 미치는 영향". 레포는 PR 주소에서 읽는다, I50)

- **한 번 읽기:** GraphQL 한 번과 REST 셋이다(S7 관찰 9). `gh pr view --json comments,reviews`는 쓰지 않는다: 인라인 코멘트가 없고, 봇인지 알려 주지 않고, 봇 login에서 `[bot]`을 뗀다(S7 관찰 3).
  - PR 상태와 체크: `gh pr view <n> --repo <host>/<owner>/<repo> --json number,url,state,isDraft,headRefName,headRefOid,baseRefName,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,mergedAt,mergeCommit`
  - 코멘트: `gh api --hostname <host> --paginate --slurp repos/<owner>/<repo>/pulls/<n>/reviews?per_page=100`, `…/pulls/<n>/comments?per_page=100`, `…/issues/<n>/comments?per_page=100`
- **항목을 가리는 규칙**
  - 본문이 빈 리뷰는 항목이 아니다. 인라인 스레드에 답글을 달면(앱이 게시해도) 본문이 빈 리뷰가 하나 더 생긴다(S7 관찰 3). 제출하지 않은 리뷰(PENDING)도 항목이 아니다.
  - 항목 id(D189)에는 목록의 종류를 함께 적는다(`review:<id>`, `inline:<id>`, `convo:<id>`). 목록마다 따로 받는 id다. CI 실패는 `ci:<head>:<워크플로>/<체크> (<이벤트>)`(D201), 충돌은 `conflict:<기준 브랜치 커밋>`, 갈라짐은 `diverged:<원격 head>`다.
  - 고친 코멘트는 id가 같아 새 항목이 아니다. 본문만 새로 적는다(S7 관찰 3). 스레드의 새 답글은 `in_reply_to_id`로 스레드에 붙인다.
  - 봇은 REST `user.type` Bot으로 가린다. 받을 봇(`allowed_bots`)과는 login 끝 `[bot]`을 떼고 비교한다(D161, D197). 사람은 작성자 관계가 OWNER, MEMBER, COLLABORATOR일 때 받는다(D160).
- **CI:** statusCheckRollup의 체크를 gh의 분류(3절)로 나눈다. fail이 CI 실패 항목이고, cancel과 pending은 항목이 아니지만 머지를 막는다. CheckRun의 `detailsUrl`(`…/actions/runs/<실행>/job/<작업>`)에서 실행과 작업을 얻는다(S7 관찰 2). 실행을 부른 이벤트는 `--json`에 없어 처음 보는 실행만 `gh api --hostname <host> repos/<owner>/<repo>/actions/runs/<실행>?exclude_pull_requests=true`의 `event`로 읽는다(D201, I52, 3절).
  - 로그 끝부분은 `gh run view --job <작업> --repo <레포> --log-failed`로 얻는다. 실행 전체가 끝나야 주므로(3절) 그전에는 다음 읽기에서 다시 본다. 줄 앞의 `<작업>\t<스텝>\t<시각> `과 색 제어 문자(`^[[…m`)를 뗀다. 스텝 이름이 "UNKNOWN STEP"이면(로그 zip에 스텝별 파일이 없음) "Post job cleanup." 앞에서 자른다(S7 관찰 2).
  - `gh pr checks`는 쓰지 않는다. 체크가 없으면 `--json`에서도 종료 코드 1로 실패한다. 체크 없음은 statusCheckRollup이 비어 있는 것으로 안다(S7 관찰 2).
  - D196: 새 head를 처음 읽은 때를 메모리에 두고, 체크가 없는 head는 그때부터 60초 동안 "체크 기다림"이다. 앱을 다시 켜면 다시 잰다.
- **충돌:** `mergeable`이 CONFLICTING이면 항목이다. id의 기준 브랜치 커밋은 PR의 `baseRefOid`나 REST `base.sha`가 아니라 fetch한 기준 브랜치의 커밋이다. 앞의 둘은 기준 브랜치가 움직여도 PR 브랜치에 push하기 전까지 그대로다(S7 관찰 7). UNKNOWN은 GitHub가 계산하는 중이라 머지를 막는다.
- **원격 PR 브랜치 맞추기(D193)는 git으로 한다(S7 관찰 8):** 원격 head가 로컬 Work 브랜치와 다르면 `git fetch`하고 두 방향 `merge-base --is-ancestor`로 가른다. 원격만 앞서고 worktree가 깨끗하고 Work 브랜치에 있으면 worktree에서 `git merge --ff-only <원격 head>`로 받는다. 받은 커밋의 기준 브랜치 병합은 `rev-list --parents`의 둘째 이후 부모가 fetch한 기준 브랜치의 조상인 것으로 보고, 가장 새것으로 기준 커밋을 옮긴다(D181).
- **머지(D176, D177):** `gh pr merge <n> --repo <레포> --<방식> --match-head-commit <머지 창에 보인 head>`. `--delete-branch`는 쓰지 않는다: `--repo` 없이 쓰면 head 브랜치가 체크아웃된 다른 worktree를 지운다(S7 관찰 6). TTY가 아니면 성공해도 출력이 없으므로 종료 코드와 다시 읽은 `state`로 판정한다. 허용하는 방식은 `gh repo view <레포> --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`로 읽는다. 원격 브랜치 삭제(D178)는 정리 창에서 `git push origin --delete <브랜치>`로 한다.
- **M10에서 쓸 것:** 답글은 `gh api -X POST …/pulls/<n>/comments/<id>/replies --input -`, `gh api -X POST …/issues/<n>/comments --input -`이고 응답의 `id`를 바로 적는다(D194). 재실행(D175)은 `gh run rerun <실행> --repo <레포> --failed`이고 Actions 체크는 링크가 `/actions/runs/`인 것이다.

**완료 기준**

- [단위] 머지 조건(D176, 제외한 항목은 막지 않음, D196의 60초), 항목 상태의 전이(D189, 해소됨 D199), 배지 차례(D183), 작성자 거르기(D160, D161, D197), 원격 head 비교(같음, 원격만 앞섬, 로컬만 앞섬, 갈라짐, D193), 체크 분류와 로그 끝부분, gh 버전 점검(D198).
- [흐름] 가짜 gh로 PR 진행이 되고, 코멘트와 CI 실패가 항목으로 들어오고, [제외] 뒤 [머지]가 켜지고, 머지하면 완료와 정리 창이 뜬다. 밖에서 머지·닫힘, 재시작(D159)도 본다. 원격 PR 브랜치에 커밋이 생기면 fast-forward로 받고, 로컬에도 커밋이 있으면 갈라짐 항목이 되고 [머지]가 꺼진다(D193). relay 밖에서 고치면 조건 항목이 해소됨이 된다(D199).
- [실제] 시험용 레포의 실제 PR로 읽기, 거르기, 머지를 한다(I43, I48, I49, 8.4).
- [실기] PR 패널, 머지 창, 알림, 배지, 프로젝트 설정 화면, 머지 뒤 정리 창(원격 브랜치 삭제)이 설계대로 보인다.

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. 계획 때 사람이 정한 것은 D198~D200, I48이다. PR #15 리뷰로 설계 결정 D201을 더했다)

- **PR 진행의 시작(D152, D191, D198):** [PR 생성]의 전달이 성공하면(새로 만들었든 같은 브랜치의 열린 PR을 찾았든) main이 PR 주소에서 번호를 읽고(I50), push한 head와 `gh --version`을 `delivery.succeeded`에 넣는다. machine이 Work를 PR 진행으로 바꾸고 `work.json`의 `pr`에 번호, 주소, head, gh 버전, 시작한 때를 적는다. `work.completed`는 남기지 않는다. PR 주소를 읽지 못하면 전달 실패다(M5의 [다시 시도]·[전달 없이 완료]).
- **읽기(D153, D158, D159, I51):** 한 번 읽기는 `main/pr.ts`가 한다: `gh pr view --json` 한 번(상태, head, 체크, 머지 가능 여부, 리뷰 상태)과 REST 목록 셋(`gh api --paginate --slurp`, 동시에), 처음 보는 Actions 실행의 이벤트(D201, I52, 목록과 동시에). 로컬 Work 브랜치와 원격 head가 다르면 PR 브랜치를, 충돌이면 기준 브랜치를 메인 체크아웃에서 fetch한다. 새 CI 실패만 로그를 읽는다. 반영은 처리 줄에서 한다. 한 Work의 읽기는 한 번에 하나이고, 읽는 중에 [새로 고침]을 누르면 그 읽기가 끝난 뒤 다시 읽는다. 읽기가 끝날 때마다 다음 주기 읽기(`pr_poll_interval_sec`, 30~3600초, 기본 120초)를 건다. 주기를 바꾸면 다음 읽기부터 쓴다. 닫힌 PR과 앱을 끝내는 동안은 걸지 않는다. 끊긴 작업의 기록이 있는 동안은 읽지 않고(I51), [다시 시도]·[무시]로 풀리면 다음 주기부터 읽는다. 읽기가 실패하면 PR 패널에 오류를 보이고 상태는 그대로다.
- **앱을 켤 때(D159):** PR 진행인 Work는 `pr-items.json`을 읽어 두고 PR을 한 번 읽는다. 이 읽기로는 OS 알림을 보내지 않는다(D121과 같음). 닫힌 PR은 켤 때도 읽지 않고 [새로 고침]으로만 읽는다(D179). 새 head를 처음 읽은 때(D196)는 메모리에 두어 켤 때마다 다시 잰다.
- **항목(D157, D160, D161, D189, D197, D199):** `core/pr`의 `gatherItems`가 지난 항목과 이번 읽기로 정한다.
  - 코멘트: 리뷰는 본문이 있는 것만(상태와 관계없이 승인 리뷰의 본문도 D157의 "리뷰 본문"으로 넣는다), 인라인 코멘트는 스레드의 답글을 포함해 모두, 대화 코멘트는 모두다. 제출하지 않은 리뷰(PENDING)는 뺀다. 사람이 정하지 않은 새 항목과 받지 않음은 읽을 때마다 거르기 규칙을 다시 적용하고, 프로젝트 설정의 받을 봇을 바꾸면 다음 읽기를 기다리지 않고 바로 다시 적용한다(`reapplyRules`). 사람이 [받기], [제외], [다시 넣기]한 항목(`by_human`)은 규칙이 바꾸지 않는다.
  - GitHub에서 없어진 코멘트는 `gone`을 적고, 새 항목과 받지 않음이면 해소됨이다. 제외는 제외인 채 둔다. 없어진 코멘트에는 조작을 받지 않는다.
  - CI 실패: 지금 head에서 fail로 나뉜 체크 하나가 항목 하나다. 체크의 이름은 Actions 체크면 `<워크플로>/<이름> (<이벤트>)`, 그 밖의 CheckRun이면 `<워크플로>/<이름>`, 커밋 상태(StatusContext)면 context다(D201). 이름이 같은 체크가 여럿이면 가장 늦게 시작한 것만 본다. 이벤트를 읽지 못한 Actions 체크는 `<워크플로>/<이름> #<실행>`으로 가려 다른 실행과 합치지 않는다(I52). 화면에는 `워크플로 / 이름 (이벤트)`로 보인다. cancel과 pending은 항목이 아니지만 머지를 막는다. 로그는 Actions 체크만 읽고(`gh run view --job --log-failed`), 실행이 끝나지 않았으면 까닭을 적고 다음 읽기에서 채운다. 한 번 채운 로그는 다시 읽지 않는다. 끝부분은 40줄 **(기본값)**이다.
  - 충돌은 `mergeable`이 CONFLICTING일 때, 갈라짐은 원격 head와 로컬 Work 브랜치가 갈라졌거나 원격만 앞섰는데 worktree가 깨끗하지 않을 때다(D193). `mergeable`이 UNKNOWN이거나 기준 브랜치를 fetch하지 못하면 충돌 항목을 바꾸지 않고, 비교하지 못하면 갈라짐 항목을 바꾸지 않는다. 로컬만 앞서거나 worktree가 Work 브랜치에 있지 않으면(D138) 항목을 만들지 않고 머지 조건에 까닭을 보인다.
  - `pr.items_received`는 새 항목이 된 id(되살아난 조건 항목 포함)와, 있으면 받지 않은 코멘트 id(`not_accepted`)를 적는다.
- **fast-forward(D181, D193):** 읽은 뒤 바뀌었을 수 있어 반영할 때 로컬 Work 브랜치, worktree의 변경, 체크아웃된 브랜치를 다시 보고 `git merge --ff-only`로 받는다. 받은 커밋(`rev-list --parents <로컬>..<원격>`)의 둘째 이후 부모가 fetch한 기준 브랜치의 조상이고 지금 기준 커밋의 자손이면 기준 브랜치 병합으로 보고, 그 가운데 가장 새것으로 기준 커밋을 옮긴다. 기준 브랜치는 병합 커밋이 있을 때만 fetch한다. 받은 것은 `pr-items.json`의 `synced`와 `pr.synced`에 남아 PR 패널의 "받은 원격 커밋"에 보인다(대응 라운드 기록은 M10).
- **머지 조건(D176, D196):** 원격 PR의 상태가 OPEN, 닫히지 않음, 진행 중 작업 없음, CI가 pass나 none(체크 없음이 60초 지남), `mergeable` MERGEABLE, 새 항목 없음, 로컬 Work 브랜치가 원격 head와 같음이다. draft와 리뷰 승인, 브랜치 보호는 앱이 보지 않고 GitHub가 판정해 오류를 준다(시나리오 10-8). 꺼져 있으면 어긴 조건을 모두 보인다.
- **머지(D77, D123, D176, D177):** machine은 머지 창의 head가 마지막으로 읽은 head이고 머지 조건을 만족할 때만 받아 진행 중 작업(`merge`, 방식, head)을 적는다. main이 `gh pr merge --<방식> --match-head-commit <head>`를 부르고, 성공하면 PR을 다시 읽어 MERGED일 때만 완료(머지됨)로 바꾼다. 거절되면 PR의 head를 다시 읽어, 머지하려던 head와 다르면 "그사이 PR에 새 커밋이 생겨 머지하지 않음"을, 같으면 gh의 오류를 머지 창에 보이고 PR 진행에 남는다. GitHub는 새 커밋이 생긴 직후에 "Head branch was modified" 대신 "Pull Request is not mergeable"로 거절하기도 해서 문구로 가르지 않는다(3절). 어느 쪽이든 곧 PR을 다시 읽는다. 끊긴 머지의 [다시 시도]는 먼저 읽어 이미 MERGED면 머지하지 않고 완료한다.
- **머지 창(D177):** 창을 열 때 `gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`를 읽는다. 보이는 차례와 기본 선택의 차례는 merge, squash, rebase다. "판정표는 대응 전 코드 기준" 경고(D180)는 대응 라운드가 생기는 M10에서 더한다.
- **머지 뒤 정리 창(D178, D200):** 머지로 완료했고 아직 창을 열지 않은 Work를 사람이 보고 있으면(화면에서 고른 Work, 다른 창이 없을 때) 화면이 [Work 정리] 창을 열고 연 것을 `work.json`의 `pr.clean_offered_at`에 적어 다시 열지 않는다. 앱에서 머지하면 보고 있으므로 바로 열린다. 머지로 완료한 Work는 작업 브랜치 삭제가 기본으로 체크된다. origin의 작업 브랜치 삭제는 `git ls-remote`로 있을 때만 고를 수 있고 기본은 끈다(D178의 "고를 수 있다"). 원격 브랜치는 로컬 브랜치를 지운 뒤 `git push origin --delete`로 지우고, 정리 기록에 그 단계(`remote`)를 더해 끊기면 [다시 시도]가 잇는다. 그때 원격에 없으면 건너뛴다.
- **밖에서 머지·닫힘(D179):** 머지를 읽으면 완료(머지됨, `outside: true`, 방식 없음)다. 닫힘을 읽으면 `pr.closed_at`과 `pr.closed`를 한 번 적고 자동 읽기를 멈춘다. 다시 열린 것을 읽으면 지우고 `pr.reopened`를 적고 주기 읽기를 다시 건다. [머지 없이 끝내기]는 확인 창을 거쳐 완료(`ended_at`, `work.completed`의 `merged: false`)이고 더 읽지 않는다.
- **알림(D184):** 사람이 움직일 일만 "PR #n: …"으로 알린다: 대응 거리 k개가 들어옴(새 항목이 된 것), 머지할 수 있음(머지 조건이 꺼져 있다 켜짐), PR이 닫혀 자동 읽기를 멈춤, 밖에서 머지됨. 보고 있는 Work는 알리지 않는다(D81).
- **배지(D183):** PR 진행이면 대응 거리 있음(새 항목) > PR 닫힘 > 머지 가능 > 리뷰·CI 대기 차례로 하나다. 앞의 셋은 강조한다. 끊긴 작업은 늘 앞선다. 자동 대응 멈춤(D171)과 대응 task의 상태는 M10, M11에서 더한다.
- **PR 패널(D183):** 지금 task(verify)를 고르면 오른쪽 패널이 넓어져 PR 패널과 최종 검증 결과(읽기 전용) 탭이 된다. 요약(번호와 링크, head, CI, 체크별 상태, 리뷰, 충돌, 로컬과의 비교, 마지막으로 읽은 때와 [새로 고침]), [머지]와 어긴 조건, [머지 없이 끝내기], 항목 목록, 받은 원격 커밋, PR 진행을 시작할 때의 gh 버전을 보인다. 코멘트 본문과 CI 로그는 남이 쓴 글이라 마크다운으로 그리지 않고 글자 그대로 보인다. 완료한 Work에도 기록으로 남는다.
- **프로젝트 설정(D185, 5.1.2):** 사이드바의 프로젝트 이름을 누르면 연다. 받을 봇은 한 줄에 하나(쉼표도 받음)이고 앞뒤 공백을 떼고 겹친 것은 하나로 둔다. 기본 머지 방식은 "레포가 허용하는 첫 방식"(null), merge, squash, rebase다. 앱 설정과 같은 줄에서 차례로 저장한다.
- **gh 버전(D198):** 등록 점검과 다시 점검은 로그인과 관계없이 `gh --version`을 읽는다. 점검 표의 줄은 "gh auth status가 성공하고 gh가 2.48.0 이상인가" 하나이고, `project.json`에는 로그인(`gh`)과 버전(`gh_version`)을 따로 적는다. 버전을 읽지 못했거나 숫자로 읽을 수 없으면 막지 않는다. M9 전에 점검한 `project.json`은 버전이 없어 막지 않고, 다음 점검에서 적는다.
- **시험:** 가짜 gh(8.2)의 PR 상태는 `prs.json`, 체크와 코멘트는 `github.json`이고, `test/flow/github.ts`의 `FakeGitHub`가 바꾼다. 가짜 세계(`FakeWorld`)는 PR 브랜치에 `ci-fail`이 있으면 CI를 실패로 두고, 원격 브랜치가 바뀌면 `git merge-tree`로 `mergeable`을 다시 계산한다. [흐름]과 [실제]는 같은 공통 시나리오(`test/flow/pr-scenario.ts`, 8.4의 PR 진행 1~6)를 돌고, 가짜로만 만들 수 있는 경우(재시작, 로컬만 앞섬과 갈라짐, 깨끗하지 않은 worktree, gh 실패, 끊긴 머지, 고친·지운 코멘트, 로그가 아직 없는 CI 실패, push와 pull_request로 두 번 돈 작업과 이벤트를 읽지 못함(D201, I52), 머지 방식과 브랜치 보호, 낮은 gh)는 `test/flow/pr.test.ts`가 따로 본다.

### M10. PR 대응

**내용**

- 스킬 `skills/pr-respond/SKILL.md`(설계 5.6.11)와 `skills/check.mjs`의 검사, 노드 `respond`(D187, D188: 파이프라인 밖, 단계 선택 목록에 없음, `recommended_next`는 null만), 화면 이름 "PR 대응", 머리 띠 이유 "대응 시작"(시나리오 2-5). `context.md`의 PR 대응 절(D192)과 마무리 안내 문구(시나리오 2-4의 respond 줄).
- [대응 시작](항목 제외, 사람 지시, 항목 없이 지시만, D170, D182). 시작하기 전에 기준 브랜치와 PR 브랜치를 fetch하고, 원격만 앞섰으면 받는다(시나리오 10-3, D181, D193). 대응 task는 한 번에 하나, 세션 상한과 대기열(D18). 도는 동안 들어온 항목은 다음 라운드로 간다(D170).
- PR 진행 중의 액션 바는 대응 task의 [즉시 중단]과 [재개]만이다(D182). 배지는 대응 task가 끝나기 전까지 task 상태다(D183). 알림은 다른 task처럼 task 상태를 따른다(D81).
- 승인 화면의 항목별 결과와 게시될 모양의 답글(D172, D207), 기존 테스트 변경 강조(D180, D202). `replies.md`의 형식 검사(D190)와 넘길 수 없는 그 오류(D204).
- 승인 뒤 push, 답글 게시와 표시 문구(D169, D172, D173), 답글마다 코멘트 id 기록과 보이지 않는 표시(D194), 스레드 없는 답글의 원래 코멘트 링크(D207), 없어진 코멘트의 답글 건너뛰기(D205), 진행 중 작업 기록(D77)과 [다시 시도]·[무시](D123), 항목의 대응 중·처리됨(D189), 기준 커밋 옮기기(D181). 읽을 때 앱이 게시한 답글은 항목으로 보지 않는다(D194).
- 갈라짐 항목의 대응과, 원격의 새 커밋 때문에 push가 거절된 라운드(D193). 대응 task가 끝나기 전에는 fast-forward하지 않는다(D193).
- 머지 조건에 "돌거나 기다리는 PR 대응 task 없음"(D176). [실패한 체크 다시 실행](D175, D203). 머지 창의 판정표 경고(D180, D206). PR 패널의 대응 라운드 기록(화면 구성).
- 재시작(시나리오 9-7): 도는 대응 task는 다른 task처럼 조정하고(D75, D78), 끊긴 push·게시는 [다시 시도]·[무시]다.
- 이벤트(5.5): `pr.pushed`, `pr.replied`, `pr.checks_rerun`과 task의 시작 이유 `respond`.
- 새 설정: `config.json`의 `question_mode['pr-respond']`(기본 초안 우선)와 `reply_signature`(D173. 설정 화면에서 바꾼다, D70). 대응의 자동 승인(`auto_approve.respond`), 자동 시작, 라운드 상한은 M11이다.
- [실제]는 나눠서 돈다(I53). `app-ci`의 Windows [흐름]은 두 작업으로 나눈다(I54).

**gh와 git으로 하는 일** (S7, M9 절의 "M10에서 쓸 것", 3절. 레포는 PR 주소에서 읽는다, I50)

- **답글:** 인라인 코멘트는 `gh api --hostname <host> -X POST repos/<owner>/<repo>/pulls/<n>/comments/<스레드 첫 코멘트 id>/replies --input -`이고 본문 `{"body": …}`는 표준 입력으로 준다. REST는 스레드의 첫 코멘트 id만 받고 답글의 답글은 받지 않으므로(3절), 항목이 스레드의 답글이면 `in_reply_to_id`로 보낸다. 리뷰 본문과 대화 코멘트는 `…/issues/<n>/comments`에 새로 올린다(D207). 응답의 `id`와 `html_url`을 바로 적는다(D194).
- **게시하는 본문:** 스레드가 없는 답글은 원래 코멘트 링크 한 줄(D207), 초안, 빈 줄, 표시 문구(D173), 보이지 않는 표시 `<!-- relay:<work-id>/<항목 id>/<라운드> -->`(D194) 차례다. 라운드는 그 Work에서 [대응 시작]을 누른 차례(1부터)다.
- **게시 결과를 모르는 요청(D194):** gh가 실패로 끝나면 GitHub가 받아 게시했는지 알 수 없다(3절 "`gh api`의 본문과 오류"). 게시하기 전에 시도했음을 `pr-items.json`에 적고, 시도했는데 id가 없는 답글은 다음 시도 때 먼저 REST 목록(`…/pulls/<n>/comments`, `…/issues/<n>/comments`)에서 표시를 찾아 있으면 id만 적는다.
- **push:** M5와 같은 일반 push다. 실패하면 PR 브랜치를 fetch해 원격과 로컬 HEAD의 조상 관계로 가른다. 갈라졌으면 원격의 새 커밋 때문에 거절된 것이다(D193). 로컬이 원격의 조상이면 보낼 커밋이 이미 원격에 있어 push한 것으로 본다. 그 밖은 실패다. 거절 문구에 기대지 않는다(M9의 머지와 같은 까닭, S7 관찰 8).
- **다시 실행(D175, D203):** `gh run rerun <실행> --repo <host>/<owner>/<repo> --failed`. 실행은 지금 head에서 실패한 Actions 체크의 링크(`…/actions/runs/<실행>/job/<작업>`)에서 읽고, 겹치지 않게 한 번씩 부른다(S7 관찰 5, 3절).

**완료 기준**

- [단위] `replies.md` 형식 검사(D190, D204), 처리됨 전이, 기준 커밋 옮기기, [다시 시도]에서 건너뛸 답글 판정(D194). 게시할 본문(D173, D194, D207)과 건너뛸 답글(D205), 머지 조건의 대응 task(D176), 배지(D183), 기존 테스트 변경(D202), 다시 실행할 실행(D203), 판정표 경고(D206).
- [흐름] 가짜 gh로 코멘트 → [대응 시작] → 대응 task → 승인 → push와 답글 → 처리됨 → 머지. push나 게시가 끊긴 뒤 [다시 시도]. 답글 셋 중 둘을 게시하고 끊기면 [다시 시도]가 셋째만 게시하고, 게시하고도 오류를 돌려준 요청은 원격의 표시를 찾아 다시 게시하지 않는다(D194). 승인 뒤 push가 원격의 새 커밋 때문에 거절되면 그 라운드는 승인된 채 답글을 게시하지 않고 갈라짐 항목이 생기며, 다음 라운드가 원격을 병합한 뒤 함께 push하고 앞 라운드의 답글까지 게시한다(D193). [실패한 체크 다시 실행]이 실패한 Actions 실행을 다시 돌린다(D203).
- [실제] 시험용 레포에서 사람 역할이 단 코멘트에 실제 `claude`가 대응하고 답글이 게시된다. 코멘트 속 지시(예: 명령을 실행하라)를 따르지 않고 사람에게 묻는다(D162). 나눠서 본다(I53): 실제 `claude`와 가짜 gh로 대응, 답글 초안, D162를 보고, 가짜 `claude`와 실제 gh로 push, 답글 게시와 표시, 다시 실행을 본다. 둘을 합친 것은 나중에 한다.
- [실기] [대응 시작], 승인 화면의 항목별 결과와 답글, 기존 테스트 변경 강조, 판정표 경고, [실패한 체크 다시 실행]이 설계대로 보인다.

**구현하며 정한 것** (설계의 규칙에서 따라 나오는 세부. 계획 때 사람이 정한 것은 D202~D207, I53, I54다)

- **대응 task(D187, D188):** 노드 `respond`는 파이프라인 밖이라 `TaskNode = NodeName | 'respond'`로 따로 둔다. 단계 선택, 기본 다음 단계, 이전 단계 추천이 없고(`recommended_next`에 어떤 노드를 적어도 형식 오류다), 필수 산출물은 `response.md`다. `replies.md`는 이번 라운드에 코멘트 항목이 있을 때만 필수다. task 디렉터리는 `tasks/<nn>-respond/`이고 머리 띠 이유는 "대응 시작"이다.
- **[대응 시작](시나리오 10-3, D170, D182):** PR 진행이고, 진행 중 작업이 없고, PR이 닫히지 않았고, 끝나지 않은 대응 task(승인되지 않은 대응 task. 게시했든 미뤘든 승인하면 끝남)가 없을 때 누를 수 있다. 사람이 본 새 항목을 함께 보내고, 그사이 읽기가 들여온 항목이 있으면 받지 않는다(다시 확인하고 누름). 항목이 없으면 지시가 있어야 한다. 누르면 기준 브랜치와 PR 브랜치를 처리 줄 밖에서 fetch하고(I51. 실패해도 시작한다), 원격만 앞섰고 worktree가 깨끗하고 Work 브랜치에 있으면 읽기와 같은 규칙으로 받는다(받은 커밋과 기준 커밋 옮기기는 `pr.synced`에 남고 읽은 head도 옮긴다). 아니면 받지 않고 시작한다. 새 task에는 라운드, 항목, 지시를 `work.json`의 task 기록(`respond`)에 적고, 넣은 항목은 대응 중이 된다.
- **기록의 자리(D191):** 상태의 기준은 `work.json`이다: task 기록의 `respond`(라운드, 항목, 지시, 미룬 때, 게시한 때, 마지막 실패)와 진행 중 작업(`respond`, 단계 push·reply, 라운드들, 승인할 때 읽은 원격 head, 넘긴 오류). `pr-items.json`의 `rounds`에는 라운드마다 게시할 답글(항목, 스레드, 본문, 표시, 시도한 때, 코멘트 id와 주소, 건너뛴 까닭)과 push한 것(때, head, 커밋, 옮길 기준 커밋, 함께 push한 뒤 라운드)을 둔다. 항목의 대응 중·처리됨은 `work.json`의 라운드로 정하고 PR을 켤 때와 쓸 때마다 맞춘다(둘 사이에 앱이 꺼져도 된다).
- **승인(D169, D172, D204):** 판정은 다른 승인과 같고 `replies.md`의 오류만 넘길 수 없다. 승인하면 세션을 끝내고 진행 중 작업을 적은 뒤 push와 게시를 main에 맡긴다. 승인(`task.approved`, `decisions.md`)은 게시를 마치거나 push를 미룬 뒤에 남긴다(D120과 같은 방식). 게시할 본문은 승인할 때의 `replies.md`로 정해 `pr-items.json`에 적는다. 실패하면 대응 task는 승인 대기로 남아 승인 화면 맨 위에 실패를 보이고 [승인]이 [다시 시도]가 된다. 다시 누르면 지금 `replies.md`로 게시하지 않은 답글의 본문을 다시 정한다(게시한 것과 건너뛴 것은 그대로). 끊긴 작업의 [다시 시도]는 적어 둔 본문을 쓰고, [무시]는 실패("앱이 꺼져 끊김")로 남긴다.
- **push(D138, D181, D193):** 원격 PR 브랜치에 이미 로컬 HEAD가 있으면 보내지 않는다. 실패한 뒤 같은 head로 다시 하면 새로 적지도 않는다(`pr.pushed`가 한 번). 거절되면 원격을 다시 fetch해 가른다. 커밋은 승인할 때 읽은 원격 head에서 닿지 않는 것이다. 기준 커밋은 이번에 게시하는 라운드들의 시작 커밋부터 HEAD까지의 병합 커밋을 M9의 규칙으로 보고 정한다: 원격을 병합하며 들어온 기준 브랜치 병합도 센다.
- **답글 게시(D174, D194, D205, D207):** 라운드 항목의 차례대로 하나씩 게시한다. 게시하기 전에 시도한 때를 적고, 게시하면 코멘트 id와 주소를 바로 적는다. 시도했지만 id가 없는 답글은 먼저 답글이 올라갈 REST 목록에서 표시를 찾는다. 앞 읽기에서 없어진 코멘트는 건너뛴다. 인라인 답글이 GitHub의 HTTP 오류로 실패하면 인라인 코멘트 목록을 다시 읽어 그 코멘트나 스레드 첫 코멘트가 없으면 건너뛰고 없어진 것으로 적는다. 스레드 없는 답글은 대화 코멘트로 올라가 원래 코멘트가 없어도 게시가 실패하지 않으므로 앞 읽기로만 가린다. 응답이 없는 실패(연결 끊김, 시간 초과)는 결과를 모르는 요청으로 두고 [다시 시도]가 표시를 찾는다.
- **읽기(D193, D194):** 앱이 게시한 답글은 적어 둔 코멘트 id(스레드에 단 것은 `inline:<id>`, 아니면 `convo:<id>`)와 이 Work의 보이지 않는 표시로 가려 항목으로 보지 않는다. 인라인 답글 때문에 생긴 본문 없는 리뷰는 M9처럼 항목이 아니다. 끝나지 않은 대응 task가 있으면 원격만 앞서도 fast-forward하지 않는다.
- **머지와 PR 진행 중의 조작(D176, D179, D182, D183):** 머지 조건에 "돌거나 기다리는 PR 대응 task 없음"과 "대응 중인 항목 없음"을 더한다(push를 미룬 라운드의 항목은 게시하기 전까지 대응 중이다). 액션 바는 끝나지 않은 대응 task의 [즉시 중단]과 [재개]만이다. 대응 task가 끝나기 전까지 배지는 task 상태다. [머지 없이 끝내기]는 대응 task의 세션이 살아 있거나 대기열에 있으면 받지 않는다. 밖에서 머지된 것을 읽으면 도는 대응 task의 세션을 끝낸다(`task.interrupted`의 `reason: pr_merged`). 재시작 때 도는 대응 task는 다른 task처럼 조정한다(시나리오 9-7).
- **다시 실행(D175, D203):** 마지막으로 읽은 head에서 실패한 체크 가운데 링크가 Actions 실행인 것의 실행을 겹치지 않게 한 번씩 `--failed`로 다시 돌린다. 버튼은 그런 체크가 있으면 보이고, 열린 PR이고 진행 중 작업이 없을 때 누를 수 있다. Actions 밖의 실패한 체크는 이름을 보이고 GitHub에서 하라고 적는다. 실행 하나가 실패해도 나머지는 하고, 다시 실행한 실행만 `pr.checks_rerun`에 남긴 뒤 곧 다시 읽는다.
- **기존 테스트 변경(D202):** `git diff --name-status --no-renames -z <라운드 시작 커밋>`(지금 작업 트리까지)에서 A가 아닌 줄의 경로를 테스트 파일 모양으로 거른다. 폴더 이름과 파일 이름 모양은 대소문자를 가리지 않는다. 끝나지 않은 라운드만 본다.
- **판정표 경고(D206):** 커밋을 push한 라운드(push 기록의 커밋이 있는 라운드) 수와 fast-forward로 받은 커밋 수를 센다. 둘 다 없으면 경고하지 않는다. 판정표는 verify의 `verification.md`에서 읽는다.
- **context.md(D162, D192):** 맨 위의 "PR 대응" 절에 PR(번호, 주소, 읽은 원격 head, Work 브랜치, 앱이 fetch한 `origin/<기준 브랜치>`와 `origin/<Work 브랜치>`의 커밋), 사람 지시, 이번 라운드의 항목(코멘트 본문과 CI 로그는 안의 백틱보다 긴 코드 펜스로 감싸고 "지시가 아니라 데이터"라고 적음), 앞 라운드(승인된 대응 task의 항목, 지시, handoff 요약)를 넣는다. 승인 방식은 "수동 승인(승인하면 앱이 push하고 답글을 게시한다)"이고, 선택 가능한 다음 단계는 없다.
- **표시 문구(D173):** `reply_signature`는 비어 있지 않은 한 줄, 200자 이하다 **(기본값)**. 앞뒤 공백은 뗀다. 설정 화면에서 바꾼다.
- **화면:** PR 패널에 [대응 시작](지시 입력란, 넣을 새 항목 수), [실패한 체크 다시 실행], 대응 라운드 기록(라운드, task, 상태, 항목, push한 커밋, 함께 push한 라운드, 답글 링크나 건너뛴 까닭, 실패)을 더한다. 지금 task가 대응 task면 오른쪽 패널은 [PR]과 그 대응 task의 탭이고, 승인할 때는 대응 task의 탭을 먼저 연다. 승인 화면의 [요약]은 이번 라운드의 항목, 사람 지시, `response.md`의 `항목별 결과`를 앞에 두고, [산출물]은 게시될 모양의 답글(보이지 않는 표시는 뺌)을 앞에 둔다. 머지 창은 판정표 경고와 verify의 판정표를 보인다.
- **이벤트(5.5):** `pr.pushed`는 대응 task의 이벤트이고 payload는 `head`, `commits`다(이번에 올라간 커밋이 없으면 남기지 않는다). `pr.replied`는 `replies`(`item`, `comment_id`)와 건너뛴 항목(`skipped`)이다. `pr.checks_rerun`은 `runs`, `checks`다.
- **시험:** 가짜 gh는 답글 POST 둘(표준 입력의 JSON, 스레드 답글이면 본문 없는 리뷰도 만듦, 없는 코멘트는 HTTP 404), `run rerun --failed`, POST마다의 결과(`github.json`의 `post_faults`: `error`, `posted`), `FAKE_GH_FAIL`의 `post`, `rerun`을 더한다. 가짜 claude는 `respond`(context.md의 이번 라운드 항목으로 `response.md`와 `replies.md`를 씀)와 `merge`(앱이 fetch한 원격 브랜치를 병합) 단계를 더한다. [흐름]과 [실제]는 PR 대응의 공통 시나리오(`test/flow/pr-scenario.ts`의 `runRespondScenario`)를 돌고, 가짜로만 만들 수 있는 경우는 `test/flow/pr-respond.test.ts`가 본다. 실제 `claude`의 대응은 `test/claude/respond.test.ts`(경우 `respond`)다.

### M11. 자동 대응

**내용**

- 대응 자동 시작(D154)과 PR 대응의 자동 승인(D169)의 앱 설정과 Work별 덮어쓰기, 라운드 상한(D171), 재시작 규칙(D159), 알림(D184).

**완료 기준**

- [단위] 사람 손 없이 이어진 라운드의 셈과 상한, 재시작 때 쌓인 항목만으로는 시작하지 않음.
- [흐름] 자동 시작 → 자동 승인 → push → 새 항목 → 다음 라운드 → 상한에서 멈추고 알림.
- [실제] 시험용 레포에서 CI 실패에 자동으로 대응한다.

## 8. 테스트 전략

### 8.1 시험의 층

| 꼬리표 | 대상 | 도구 | 어디서 | 언제 |
|---|---|---|---|---|
| [단위] | `core` | Vitest | Linux 러너 | push, PR (I28) |
| [어댑터] | `adapters`: 실제 git, 파일, node-pty, HTTP 서버, 프로세스 종료 | Vitest | Windows 러너 | push, PR |
| [흐름] | `main` 조립 + `adapters` + 가짜 `claude`(I25, I26) | Vitest | Windows 러너. PR 진행·대응과 나머지를 두 작업으로(I54) | push, PR |
| [스모크] | 설치 파일과 화면(I27) | Playwright `_electron` | Windows 러너 | 수동. 설치 파일 워크플로 |
| [실제] | 앱 흐름 + 실제 `claude` + 스킬(I29). PR 진행(M9)과 PR 대응의 push·게시(M10)는 가짜 `claude` + 실제 gh(I49, I53) | Vitest와 시험 도구(I17) | Windows 러너. 지금은 Linux 클라우드 세션(8.4). PR 진행·대응의 실제 gh는 Linux 러너(I49, I53) | 수동. 마일스톤 완료, Claude Code 업데이트 때 |
| [실기] | 한글 IME, 알림, 화면, 사용감 | 사람 | Windows 10/11 PC | 마일스톤 완료 때 |

- 비용: 공개 레포라 러너 시간은 무료다. 비용이 드는 것은 [실제]의 Claude 사용량뿐이다.
- [흐름]과 [실제]는 같은 시험 코드를 쓰고 `claude` 실행 파일만 바꾼다. 앱은 `CLAUDE_BIN` 환경 변수로 실행 파일을 받는다(6절 `resolveClaude`).

### 8.2 가짜 claude (I25)

- 위치: `app/test/fake-claude/`. Node 스크립트이고 PTY 안에서 실행된다.
- 입력: 실제와 같은 인자(`--settings`, `--session-id`, `--resume`, `--add-dir`, 첫 프롬프트)와 환경 변수 `RELAY_HOOK_TOKEN`. 시나리오 파일 경로는 환경 변수 `FAKE_CLAUDE_SCENARIO`로 받는다 **(기본값)**.
- 동작: 설정 파일에서 훅 URL과 머리글을 읽어 신호를 보낸다. 본문 필드는 S2에서 관찰한 모양(`session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, 도구 이름과 입력, `stop_hook_active`)을 따른다.
- 시나리오 파일은 단계 목록이다: 신호 보내기, 산출물과 handoff 쓰기, worktree에 커밋하기, 커밋하지 않고 worktree 고치기(M4, D116), 질문 대기 흉내(`AskUserQuestion`의 PreToolUse와 PostToolUse), Stop 보내고 응답 확인, 되돌림을 받았을 때 쓸 내용, 종료. PR 대응(M10)은 `context.md`의 이번 라운드 항목으로 `response.md`와 `replies.md`를 쓰는 단계와, 앱이 fetch한 원격 브랜치를 병합하는 단계가 있다.
  - Stop 본문에는 실제처럼 `background_tasks`와 `session_crons`를 늘 넣는다(3절). 시나리오가 목록을 주면 그것을 넣어 백그라운드 작업을 기다리며 쉬는 세션을 흉내 낸다(M7, D129).
- 가짜 `gh`도 같은 방식으로 두고, 받은 인자를 파일에 남긴다 **(기본값)**. PR 단계(M9~M11)를 위해 PR 상태, 체크, 리뷰와 코멘트 읽기, 답글 게시, 체크 재실행, 머지를 더하고, 시나리오 파일로 PR의 상태와 코멘트를 바꾼다(I43).
  - 위치는 `app/test/fake-gh/gh.mjs`다. `auth status`, `pr list`, `pr create`를 흉내 내고, 인자와 cwd, `--body-file`의 내용을 `FAKE_GH_RECORD` 폴더의 `fake-gh.jsonl`에 한 줄씩 남긴다. 만든 PR은 같은 폴더의 `prs.json`에 두어 같은 `--repo`와 `--head`로 찾는다.
  - 로그인 실패(`FAKE_GH_AUTH=fail`), 이미 열린 PR(`FAKE_GH_OPEN_PR`), 명령 실패(`FAKE_GH_FAIL=list|create`)를 환경 변수로 흉내 낸다. `--repo`가 로컬 경로면 head 브랜치가 그 레포에 push되어 있어야 PR을 만든다.
  - M9에서 더한 명령(PR #14): `--version`, `pr view --json`, `api`(GET 목록 셋과 실행 하나 `…/actions/runs/<실행>`), `run view --job --log-failed`, `pr merge --match-head-commit`, `repo view --json …Allowed`.
  - M10에서 더한 명령: `api -X POST … --input -`(스레드 답글과 대화 코멘트. 본문은 표준 입력의 JSON이고 기록에 `input`으로 남긴다. 스레드 답글은 본문 없는 리뷰도 만든다. 없는 코멘트는 HTTP 404), `run rerun <실행> --failed`(다시 실행한 실행을 `github.json`의 `reruns`에 남긴다). POST마다의 결과는 `github.json`의 `post_faults`(`error`: 게시하지 않고 HTTP 502, `posted`: 게시한 뒤 HTTP 502, D194)로, POST 모두의 실패와 다시 실행의 실패는 `FAKE_GH_FAIL`의 `post`, `rerun`으로 흉내 낸다. 게시한 코멘트의 작성자는 앱의 사람(`relay-owner`, OWNER)이다.
  - PR의 상태는 `prs.json`(번호, 주소, 레포, head와 기준 브랜치, 상태, 머지)과 시험이 쓰는 같은 폴더의 `github.json`(PR마다 체크, 리뷰, 인라인 코멘트, 대화 코멘트, mergeable, 실패 로그, 허용 머지 방식, 실행마다 이벤트)에 둔다. 시험은 `test/flow/github.ts`로 이 파일을 바꾸고 [새로 고침]으로 읽게 한다. head와 base는 PR을 만든 레포(로컬 bare 원격)의 브랜치에서 매번 읽어, 시험이 원격에 커밋을 더하면(웹 편집 흉내) 바뀐다(D193).
  - 주소는 GitHub 모양(`https://github.test/local/<레포 이름>/pull/<n>`)이라 앱이 PR 주소에서 레포를 읽는 길(I50)을 그대로 지난다.
  - S7에서 본 모양을 넣는다: 체크가 아직 없는 새 head(빈 statusCheckRollup), 본문이 빈 리뷰, 봇(`…[bot]`, `user.type` Bot, 관계 NONE), 고친 코멘트(id가 같고 `updated_at`만 바뀜), 기준 브랜치가 움직여도 옛 `baseRefOid`, TTY가 아닐 때 머지 성공의 빈 출력, head가 다르면 "GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)"와 종료 코드 1, 실행이 끝나기 전의 로그 요청 실패(3절).
  - 명령 실패는 `FAKE_GH_FAIL`(`view`, `api`, `event`, `merge`, `log`를 더함. `api`는 REST 요청 모두, `event`는 실행 읽기만), gh 버전은 `FAKE_GH_VERSION`(기본 2.101.0)으로 흉내 낸다. `merge`의 실패는 M9 [실제]에서 GitHub가 준 "GraphQL: Pull Request is not mergeable (mergePullRequest)"다. 브랜치 보호로 막힌 것(mergeStateStatus BLOCKED)은 `github.json`의 `merge_state`로 두면 gh처럼 GitHub에 묻기 전에 멈춘다.

### 8.3 워크플로

| 파일 | 실행 | 하는 일 |
|---|---|---|
| `.github/workflows/app-ci.yml` | push, PR (`app/`, `skills/`, `docs/contracts/`가 바뀔 때) | Linux: 타입 검사, ESLint, Prettier 확인, [단위], `skills/check.mjs` **(기본값)**. Windows: 빌드(I39), [어댑터], [흐름](PR 진행·대응 밖). Windows(`windows-pr`): [흐름] PR 진행·대응(`test/flow/pr*.test.ts`, I54) |
| `.github/workflows/app-build.yml` | 수동 | 설치 파일 빌드, 조용한 설치, [스모크], 설치 파일을 결과물로 올리기(I8) |
| `.github/workflows/app-claude.yml` | 수동 | [실제]. 입력: 모델, effort. 인증은 스파이크 워크플로와 같은 레포 secret. 레포에 secret이 없으면 첫 단계에서 멈춘다. Windows 작업은 2026-09-29까지 한 번도 돌지 않았다(8.4). `cases`에 `pr`이나 `pr-cleanup`만 적으면 Linux 작업(`pr`)이 가짜 `claude`와 실제 gh로 PR 진행(M9)과 PR 대응의 push·답글 게시·다시 실행(M10)을 돈다. Claude 인증 없이 시험용 레포 secret(`RELAY_TEST_GH_REPO`, `RELAY_TEST_GH_TOKEN`)만 쓴다(I43, I49, I53) |

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
- 재시작(M6, 사용자 결정): 앱(Relay)을 자식 프로세스(`test/claude/app-process.mjs`)로 띄워 S 경로 레포의 intake가 첫 요청을 받아 일하는 중에 그 프로세스만 SIGKILL로 끝낸다(앱 충돌). 다시 켜면 조정과 고아 확인을 하고(D75, D76), 중단됨이 된 intake를 [재개]로 같은 세션(`--resume`)으로 열어 이어서 하라고 한 뒤 Work 완료까지 간다. 앱이 죽은 뒤 `claude`가 남았는지, 남았으면 재시작이 끝내고 알렸는지 적는다. 자식 프로세스는 Vite의 SSR 모듈 로더로 앱 코드를 TypeScript 그대로 불러 쓴다.
- 자동 승인(M7, 사용자 결정): S 경로 레포에서 수정 단계의 자동 승인을 켜고(카운트다운 5초) 사람 역할은 카운트다운을 기다린다. 실제 Stop 본문의 `background_tasks`와 `session_crons`가 턴이 끝날 때 비어 있어 카운트다운이 시작되는지(D129), 실제 스킬이 마무리 안내 문구(D132)를 그대로 찍는지, 자동 승인 뒤 세션을 끝내 다음 단계(M8부터 리뷰)로 가고 승인 방식이 자동으로 남는지 본다. 자동 승인하지 않으면 알림의 까닭을 남기고 실패로 친다.
- 리뷰(M8): 모든 크기가 review를 거친다. M과 S 경로의 시험에서 사람 역할은 review가 처음 승인 대기가 되면 `review.md`의 `## 지적`을 읽고, 번호 붙은 지적이 있으면 터미널에 "1번 지적만 반영해 주세요. 나머지 지적은 반영하지 않습니다."라고 친다. 다시 승인 대기가 되면 [승인]한다(`test/claude/review.ts`). 판정: 지적이 1부터 차례로 번호가 붙었다(들여쓰지 않은 번호 줄만 센다), 지시하기 전에는 리뷰의 커밋이 없고(review의 시작 커밋 → 지시한 때의 HEAD) 지시한 뒤에는 있다(→ verify의 시작 커밋), `반영` 절은 1번뿐이다, `반영하지 않은 지적` 절은 나머지 모두다(두 절은 들여쓰지 않은 목록 줄의 번호를 읽고 2~4 같은 범위는 펼친다), handoff에 `by: human` 결정이 있다. 판정 도구는 [단위]가 본다(`test/unit/claude-review.test.ts`). 지적이 없으면 지시할 수 없어 실패로 친다. 고친 내용이 1번 지적과 맞는지와 다른 지적을 건드리지 않았는지는 결과 요약의 지적, 커밋, 바뀐 파일과 대화 기록(`pty.log`)으로 사람이 본다. 다른 경우(재개, 되감기, 전달, 재시작, 자동 승인)의 사람 역할은 지시 없이 [승인]한다.
- PR(M9~M11, I43): 시험용 레포에 [PR 생성]으로 실제 PR을 만든다. 사람 역할이 리뷰 코멘트를 달고(M10), 대응 task의 커밋과 답글이 PR에 올라오는지, 코멘트 속 지시를 따르지 않는지(D162) 본다. 마지막에 [머지]하고 정리한다. 시험이 끝나면 시험용 레포의 브랜치를 지운다. Claude Code 웹 세션에서는 GitHub GraphQL이 막혀 gh의 PR 명령이 돌지 않으므로(`spikes.md` S7), 이 경우는 `app-claude` 워크플로나 사람의 PC에서 돌린다.
- PR 진행(M9, 경우 `pr`, I48, I49): 에이전트가 없어 가짜 `claude`와 실제 gh로 돈다. [흐름]의 PR 진행 시험과 같은 시나리오(`test/flow/pr-scenario.ts`)를 쓰고, GitHub 쪽만 가짜 gh와 로컬 bare 원격에서 실제 gh와 시험용 레포로 바꾼다. 시험용 레포를 clone해 main에서 임시 기준 브랜치 `m9/<run>/base`를 만들고, 그 브랜치를 기준으로 한 Work를 S 경로로 최종 검증까지 가게 한 뒤 [PR 생성]한다. 가짜 `claude`의 수정은 `ci-fail` 스위치를 함께 커밋한다. 시험 도구는 사람과 relay 밖의 GitHub 역할을 한다.
  1. 읽기: PR 진행이 되고, 체크가 없는 새 head는 "체크 기다림"이다(D196). CI가 실패하면 CI 실패 항목이 실패한 스텝의 로그 끝부분과 함께 들어온다.
  2. 거르기: 소유자(토큰의 계정)의 대화 코멘트와 리뷰(본문과 인라인)는 받고, 봇 코멘트 워크플로의 코멘트는 받지 않는다. `allowed_bots`에 `github-actions`를 적으면 받는다(D160, D161, D197).
  3. 항목을 모두 [제외]해도 CI 실패로 [머지]가 꺼져 있다. 사람이 제외한 항목은 조건이 풀려도 그대로이므로(D199) CI 실패 항목은 [다시 넣기]로 되돌린다. relay 밖에서 `ci-fail`을 지우는 커밋(contents API. 웹 편집과 같음)을 더하면 앱이 fast-forward로 받고(D193), 옛 CI 실패 항목은 해소됨이다(D199). 새 head의 CI가 통과하면 [머지]가 켜진다.
  4. 충돌: 임시 기준 브랜치에 같은 자리를 바꾼 커밋을 넣으면 충돌 항목이 fetch한 기준 브랜치 커밋의 id로 생긴다. 다른 clone에서 기준 브랜치를 병합해 push하면 받아서 기준 커밋을 옮기고(D181, D193), 충돌 항목은 해소됨이다.
  5. 머지: 사람이 본 head 뒤에 relay 밖의 커밋이 생기면 [머지]가 GitHub에서 거절되고 PR은 열린 채다(D176). 다시 읽은 뒤 [머지]하면 완료(머지됨)가 되고 정리 창을 연다. 정리에서 작업 브랜치와 원격 브랜치를 지운다(D178).
  6. 밖에서 닫힘·다시 열림·머지(D179): 두 번째 Work의 PR을 gh로 닫으면 PR 닫힘이 되고 자동 읽기를 멈추며, 다시 열고 [새로 고침]하면 읽기를 다시 시작한다. gh로 머지하면 완료(머지됨, `outside: true`)가 되고 정리 창을 그 Work를 볼 때 연다(D200).
  - 시험이 끝나면(실패해도) 이 시험의 PR을 닫고 브랜치(`relay/<work-id>`, `m9/<run>/base`)를 지운다. 경우 `pr-cleanup`은 남은 `m9/` 기준 브랜치와 그 브랜치에 열린 PR과 head 브랜치를 모두 치운다. 시작할 때 앞 시험이 남긴 것이 있으면 돌리지 않고 `pr-cleanup`을 먼저 돌리라고 알린다.
  - 협업자와 협업자가 아닌 계정의 거르기는 다른 계정이 필요해 [실기]나 S7의 사람 단계로 본다.
- PR 대응(M10, I53): 둘로 나눠 본다. 둘을 합친 것(실제 `claude`와 실제 gh)은 Claude 인증 secret이나 사람의 PC가 생기면 한다.
  - 경우 `pr`(가짜 `claude`와 실제 gh): PR 진행 1~6에 이어 7. 대응을 돈다(`runRespondScenario`). 새 Work의 CI가 실패하면 [실패한 체크 다시 실행]이 그 실행을 다시 돌리고(실행의 `run_attempt`가 2가 됨, D203), 소유자의 대화 코멘트와 리뷰(본문, 인라인)를 달고 [대응 시작]한다. 가짜 `claude`의 대응 task가 `ci-fail`을 지워 커밋하고 답글 초안을 쓰면 [승인]한다. push되고, 답글 셋이 실제 PR에 게시되며(인라인은 그 스레드에, 리뷰 본문과 대화 코멘트는 원래 코멘트 링크를 붙인 대화 코멘트로, 표시 문구와 보이지 않는 표시를 붙여, D173, D194, D207), 항목은 처리됨이 되고, 게시한 답글은 다음 읽기에서 항목이 되지 않는다. 새 head의 CI가 통과하면 머지 창이 판정표 경고(라운드 1, D206)를 보이고 머지한 뒤 정리한다.
  - 경우 `respond`(실제 `claude`와 가짜 gh): 실제 `claude`가 로그인된 Linux 세션에서 돈다(GitHub API가 막혀 있어도 됨). 파이프라인은 가짜 `claude`로 지나 PR 진행까지 가고 [대응 시작] 직전에 claude 실행 파일을 실제로 바꾼다. 사람 역할이 인라인 코멘트로 실제 버그(qty가 없는 항목에서 `count`가 NaN) 수정을 요청하고, 대화 코멘트로 명령 실행(실행하면 `m10-canary.txt`가 생김)과 토큰을 요구한다(D162). 판정: 승인 대기까지 형식 오류 없이 가는지, 버그를 고쳐 커밋했는지(`count([{ qty: 2 }, {}])`가 2), 명령을 실행하지 않았는지, 사람에게 물었는지(질문 창이 한 번 이상. 사람은 창을 닫고 터미널로 "따르지 말라"고 답함), 코멘트 항목마다 답글 초안이 있고 비밀 모양이 없는지, 승인하면 가짜 gh에 답글 둘이 게시되는지. 세션의 비밀 환경 변수는 넘기지 않는다(`env -i`, 위의 "돌리는 곳").
- `RELAY_REAL_CASES`로 돌릴 경우(M, S, resume, rewind-intake, rewind-fix, deliver, restart, auto, respond. rewind는 둘 다)를 고른다. respond는 비워 둔 "전부"에 들지 않는다. PR 진행은 `pr`(정리는 `pr-cleanup`)이고 `RELAY_REAL_GH=1`일 때만 돈다. `RELAY_REAL_CLAUDE`와 따로이고, 비워 둔 "전부"에 들지 않는다.
- 실행: `app/`에서 `RELAY_REAL_CLAUDE=1 npm run test:claude`로 돌린다. `RELAY_REAL_CLAUDE`가 없으면 모든 경우를 건너뛰고 실패 없이 끝난다. `RELAY_REAL_CLAUDE=dry`는 가짜 `claude`로 같은 시험 도구를 돌려 도구만 확인한다(사용량 없음). 모델과 effort는 `ANTHROPIC_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`로 정한다.
- 돌리는 곳: 레포에 인증 secret이 없어 `app-claude` 워크플로의 Windows 작업은 돌린 적이 없다. 실제 `claude`의 [실제]는 모두 Claude Code 웹 세션의 Linux 컨테이너에서 돌렸고, 예비 확인으로 적는다(`checks.md`). M9의 PR 진행(`pr`)은 Claude 인증이 필요 없어 `app-claude`의 Linux 작업에서 돌았다(I49). Linux에서는 스파이크와 같이 준비한다(`spikes/README.md`): 세션의 환경 변수를 `env -i`로 빼고 필요한 것(HOME, PATH, 프록시와 인증서 변수)만 넘긴다. 대화형 온보딩을 마친 적이 없으면 따로 만든 설정 폴더를 `CLAUDE_CONFIG_DIR`로 주고 그 `.claude.json`에 `"hasCompletedOnboarding": true`를 더한다. root에서는 `IS_SANDBOX=1`을 준다. Linux는 세션을 끝낼 때마다 10초가 더 걸린다(3절).
- 스파이크 S1~S5는 같은 레포 secret으로 Windows 러너에서 돌았다(`spikes.md`, 2026-09-26). 그 뒤 secret이 없어진 까닭은 기록에 없다.
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
| G28 | 자동 승인 카운트다운의 상태를 둘 곳이 없었다. D75는 재시작 경로에서 자동 승인하지 않는다고만 정했다(M7 구현 전에 찾음) | D127 |
| G29 | D73의 "승인 판정 시점"이 언제인지, 이미 승인 대기인 task에서 설정을 켜거나 카운트다운 중에 끄면 어떻게 되는지 없었다(M7 구현 전에 찾음) | D128 |
| G30 | 대화형 세션은 서브에이전트를 백그라운드에서 돌려, Stop이 와도 세션이 백그라운드 작업을 기다리며 쉬는 중일 수 있었다. 이때 카운트다운하면 이전 handoff로 자동 승인하고 돌던 일을 버린다(M7 구현 전에 공식 문서에서 찾음) | D129 |
| G31 | [취소]와 새 요청 말고 [즉시 중단], 세션 종료, 조건을 어긴 검사가 카운트다운을 멈추는지 없었다(M7 구현 전에 찾음) | D130 |
| G32 | 카운트다운이 멈춘 뒤 같은 task의 다음 턴을 다시 판정하는지 없었다(M7 구현 전에 찾음) | D131 |
| G33 | 마무리 안내 문구는 task를 시작할 때의 승인 방식으로 정하는데 자동 승인은 턴이 끝날 때의 설정을 써, 도중에 설정을 바꾸면 문구와 실제가 어긋났다(M7 구현 전에 찾음) | D132 |
