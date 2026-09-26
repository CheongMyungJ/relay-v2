# relay-v2 구현 계획

- 대상 설계: `docs/design.md` v0.4 (MVP)
- 상태: 작성 중. 주제마다 사람과 문답으로 정한다(설계 부록 A의 진행 규칙).

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
| 2 | 모듈 구조 | 저장소(5.1), 상태 기계(3.3), task 실행(PTY, 훅 서버, 설정 파일 생성), 형식 검사(5.2.1), git 작업(worktree, 되감기, 전달), 화면. 모듈 사이 경계와 IPC | 질문 중 |
| 3 | 스파이크 코드 재사용 | `spikes/lib`와 `skills/check.mjs`에서 가져다 쓸 것과 새로 쓸 것 | |
| 4 | 마일스톤 | 만드는 순서와 마일스톤마다의 완료 기준. 최소 흐름을 먼저 세로로 관통한다 | |
| 5 | 테스트 전략 | 단위 테스트, 러너 통합 시험, 실기 확인의 나눔과 비용 | |
| 6 | 설계와의 어긋남 | 1~5를 정하며 찾은 설계의 빈 곳과 어긋난 곳(8절 목록) | |

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

## 3. 확인한 사실

구현 선택의 전제가 되는 도구 동작이다. 출처와 확인 날짜를 적는다.

| 항목 | 내용 | 출처 (확인일) |
|---|---|---|
| Electron 프로세스 | 메인 프로세스는 Node.js 환경이라 Node API를 모두 쓴다. 렌더러는 기본으로 Node API가 없다. preload는 렌더러에서 Node 접근을 가진 채 먼저 실행되고, context isolation(기본 켜짐) 아래에서 `contextBridge.exposeInMainWorld()`로 API를 내보낸다. utility process는 메인이 띄우는 Node 자식 프로세스다 | Electron 문서 `docs/tutorial/process-model.md` (2026-09-26) |
| 네이티브 모듈 | Electron은 Node와 ABI가 달라 네이티브 모듈을 Electron용으로 다시 빌드해야 한다. `@electron/rebuild`가 이를 한다 | Electron 문서 `docs/tutorial/using-native-node-modules.md` (2026-09-26) |
| node-pty 1.1.0 | `node-addon-api`(N-API) 기반이고, 패키지에 `win32-x64`, `win32-arm64`, `darwin-*` 사전 빌드(`pty.node`, `conpty.node`, `conpty.dll`, `OpenConsole.exe`)가 들어 있다. 설치 때 사전 빌드가 있으면 컴파일하지 않는다. 스레드 안전하지 않아 여러 worker thread에서 쓰지 말라고 한다. Windows는 1809 이상의 ConPTY를 쓴다 | npm 패키지 `node-pty@1.1.0` 내용, README (2026-09-26) |
| electron-builder | `npmRebuild`의 기본값은 `true`이고, 패키징 전에 `@electron/rebuild`로 네이티브 모듈을 다시 빌드한다 | electron-builder `app-builder-lib/scheme.json` (2026-09-26) |
| 최신 버전 | electron 44.4.5, node-pty 1.1.0, @xterm/xterm 6.0.0, electron-builder 26.15.3, electron-vite 5.0.0, vitest 5.0.2 | npm 레지스트리 (2026-09-26) |
| Claude Code 동작 | 훅, 스킬, deny 규칙, 첫 실행 창은 `docs/spikes.md`의 S1~S5 결과를 따른다(2.1.283) | `docs/spikes.md` |
| HTTP 훅 머리글 | HTTP 훅에 `headers`를 줄 수 있다. 값에 `$VAR` 형태로 환경 변수를 넣을 수 있고, `allowedEnvVars`에 적은 변수만 풀린다. 응답 본문은 명령 훅과 같은 JSON 출력 형식이다. 기본 제한 시간은 600초(UserPromptSubmit은 30초)다 | Claude Code 문서 hooks (2026-09-26) |

- N-API 사전 빌드가 Electron 44에서 다시 빌드 없이 로드되는지, 설치 파일(asar)에서 `OpenConsole.exe`와 `.node`가 풀려 나와 동작하는지는 아직 확인하지 않았다. 마일스톤 0의 러너 시험에서 확인한다.

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
- **YAML과 스키마 검사:** `skills/check.mjs`와 같은 `yaml`, `ajv`(draft 2020-12)를 쓴다. 재사용 범위는 주제 3에서 정한다.

## 5. 모듈 구조

(주제 2에서 채운다)

## 6. 스파이크 코드 재사용

(주제 3에서 채운다)

## 7. 마일스톤

(주제 4에서 채운다)

## 8. 테스트 전략

(주제 5에서 채운다)

## 9. 설계 확인 필요 목록

주제 1~5를 정하며 찾은 설계의 빈 곳이다. 주제 6에서 한꺼번에 묻는다. 앞 주제를 막는 것은 그 주제에서 먼저 묻는다.

| # | 빈 곳 | 관련 설계 |
|---|---|---|
| G1 | 스킬 원본을 `<RELAY_HOME>/skills/`에 두는 방법이 없다. 앱에 묶어 배포한 스킬을 첫 실행 때 복사하는지, 앱을 업데이트하면 덮어쓰는지, 사람이 고친 스킬은 어떻게 하는지 | 5.1, 5.6.3 |
| G2 | 훅 서버의 보안과 task 구분이 없다. 같은 PC의 다른 프로세스가 가짜 Stop을 보낼 수 있다. 훅 요청이 어느 task의 것인지 URL로 구분할지 `session_id`로 구분할지 | D20, 시나리오 3 |
| G3 | `context.md`의 "마무리 안내 문구"의 내용이 정해져 있지 않다 | 시나리오 2-4, 5.6.2 |
| G4 | 확인한 Claude Code 버전(2.1.283)과 다른 버전이 설치되어 있을 때 앱이 할 일이 없다(경고 여부) | D92, D95 |
| G5 | 앱이 `claude` 실행 파일을 찾는 방법이 없다(PATH, 네이티브 설치 위치, npm `.cmd`) | 6절, 7절 |
