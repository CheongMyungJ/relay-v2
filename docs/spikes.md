# relay-v2 스파이크

설계(`docs/design.md`)의 전제 중에서 실제로 실행해 봐야 알 수 있는 것을 확인한다. 스파이크마다 다음 네 가지를 적는다.

- 확인할 것
- 절차
- 성공 기준
- 실패하면 바꿀 설계

## 공통 규칙

- **환경:** Windows 10/11 네이티브 실기에서 하는 것이 필수다. macOS는 선택이다(D92).
- **코드:** 스파이크 코드는 `spikes/`에 최소한으로 두고, 실행 방법을 `spikes/README.md`에 적는다.
- **결과 기록:** 스파이크마다 결과 표에 한 줄씩 더한다. Claude Code를 업데이트하면 S2~S6을 다시 확인한다.

  | 날짜 | Claude Code 버전 | OS | 결과(통과/실패) | 메모 |
  |---|---|---|---|---|

- **자동 실행:** GitHub Actions의 `spikes` 워크플로(`.github/workflows/spikes.yml`)가 Windows 러너에서 S1(한글 IME 제외)~S5를 돌린다. 수동으로만 실행한다. 결과는 실행 요약과 `spike-results` 결과물에 올라가고, 사람이 읽고 아래 결과 표에 옮긴다. 러너는 Windows Server라 **예비 확인**으로 기록하고, 결과 표의 OS 칸에 러너 이미지를 적는다(D93). S7은 같은 워크플로의 Linux 작업에서 돈다(`spikes` 입력에 S7만 적음, `docs/implementation.md` I47).
- **인증:** 레포 secret `CLAUDE_CODE_OAUTH_TOKEN`(Claude 구독, `claude setup-token`으로 발급) 또는 `ANTHROPIC_API_KEY`(Claude Console 사용량 과금). 둘 다 있으면 구독 토큰을 쓴다. S7은 Claude 인증 대신 시험용 레포 secret `RELAY_TEST_GH_REPO`, `RELAY_TEST_GH_TOKEN`을 쓴다(I43).
- **실패했을 때:** "실패하면 바꿀 설계"의 절을 사용자와 다시 정한다. 스파이크 문서에서 설계를 바꾸지 않는다.

---

## S1. 터미널 임베드

**확인할 것:** node-pty(ConPTY)와 xterm.js로 띄운 Claude Code가 일반 터미널과 같이 동작하는가. 세션을 프로세스 트리째 끝낼 수 있는가.

**절차**

1. Electron 최소 앱에서 node-pty로 `claude`를 실행하고 xterm.js에 붙인다.
2. 한글을 Windows 기본 IME로 입력한다. 조합 중 표시, 확정, 백스페이스, 한영 전환을 확인한다.
3. 창 크기를 바꿔 터미널 크기가 따라가는지 확인한다. 긴 출력을 스크롤한다.
4. 출력을 파일(`pty.log`)로 저장하고, 앱을 다시 켰을 때 읽기 전용으로 다시 보여 준다.
5. 세션을 프로세스 트리째 종료한다. 작업 관리자에서 `claude`와 그 자식 프로세스가 남지 않는지 확인한다.
6. 앱을 강제 종료한 뒤 `claude` 프로세스가 남는지 확인한다. 남으면 기록한 프로세스 ID와 시작 시각으로 찾아 종료한다.

**자동 실행 범위:** 2(한글 IME)는 러너에서 확인할 수 없어 실기에서 사람이 한다. 러너는 IME 대신 한글 문자열 표시와 백스페이스만 확인한다.

**성공 기준**

- 한글 입력이 일반 터미널과 같게 조합·확정된다.
- 화면이 깨지지 않고 크기 변경이 반영된다.
- 트리 종료 뒤 남은 프로세스가 없다.
- 앱 강제 종료 뒤 남은 프로세스를 ID와 시작 시각으로 찾아 끝낼 수 있다.

**실패하면 바꿀 설계**

- 한글 입력이 안 되면: 사람이 입력하는 보조 입력창을 검토한다. 사람의 입력을 PTY로 보내는 것이라 비목표(1.2)의 "주입"과는 다르다.
- 트리 종료가 안 되면: 시나리오 3(중단), 8(정리), 9(고아 프로세스)의 종료 방법을 다시 정한다.

**결과**

| 날짜 | Claude Code 버전 | OS | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-26 | 2.1.283 | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | 통과(IME 제외) | 실행 #6 |

**관찰 (2026-09-26, 러너, 실행 #6)**

- ConPTY 위에서 Claude Code가 정상 동작했다. 한글 문자열 표시와 백스페이스 한 번에 한 글자 삭제가 맞았다(IME 조합 입력은 아님).
- 크기 변경 뒤에도 세션이 살아 있고 다시 그려졌다. `pty.log`를 다시 재생하면 화면 글자가 나왔다.
- 프로세스 트리 종료(`taskkill /T /F`) 뒤 남은 프로세스가 없었다.
- 앱 역할 프로세스만 강제 종료했더니 claude도 함께 끝났다. 고아가 남지 않았다. 시나리오 9의 고아 확인(D76)은 그대로 두되, 실제로는 드물 것으로 보인다.
- 세션을 자주 강제 종료하면 Claude Code가 "전체 화면 렌더러가 여러 번 시작에 실패했다"며 기본 렌더러로 바꾼다. 기본 렌더러에서는 선택 창의 화살표 키 입력이 창을 닫는 것으로 처리된 일이 있었다(실행 #5).

---

## S2. HTTP 훅

**확인할 것:** task 설정 파일의 HTTP 훅이 설계에서 쓰는 모든 시점에 오는가. Stop 되돌림이 동작하는가. 앱이 꺼져 있어도 세션이 계속되는가.

**절차**

1. 로컬 HTTP 서버를 띄우고, 받은 요청을 모두 기록한다.
2. `--settings <task 설정>`에 HTTP 훅을 등록한다: UserPromptSubmit, Stop, Notification, SessionEnd, PreToolUse·PostToolUse(`AskUserQuestion`만).
3. 다음을 차례로 한다.
   - 프롬프트를 입력한다 → UserPromptSubmit
   - 에이전트가 `AskUserQuestion`을 쓰게 한다 → PreToolUse. 답한다 → PostToolUse
   - 턴이 끝난다 → Stop
   - `/exit` → SessionEnd
4. Stop에 `{"decision":"block","reason":"형식 오류: …"}`로 응답한다. 에이전트가 이유를 받아 이어서 작업하는지 확인한다. 두 번 되돌린 뒤 세 번째에는 통과시킨다.
5. 서버를 끈 채로 턴을 끝낸다. 세션이 계속되고, 비차단 오류로 표시되는지 확인한다.
6. 요청 본문에 세션 id와 도구 이름처럼 앱이 구분에 쓸 값이 있는지 기록한다.

**성공 기준**

- 각 신호가 기대한 시점에 한 번씩 온다.
- Stop 되돌림으로 에이전트가 이어서 작업한다.
- 서버가 꺼져 있어도 세션이 멈추지 않는다.

**실패하면 바꿀 설계**

- `AskUserQuestion`의 PreToolUse·PostToolUse가 오지 않으면: 질문 대기 표시(D24, D35)를 다시 정한다.
- Stop 되돌림이 안 되면: 형식 오류는 승인 화면에만 표시하고 사람이 터미널에서 알린다(D21 수정).

**결과**

| 날짜 | Claude Code 버전 | OS | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-26 | 2.1.283 | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | 통과 | 실행 #6 |

**관찰 (2026-09-26, 러너, 실행 #6)**

- UserPromptSubmit, Stop, PreToolUse·PostToolUse(`AskUserQuestion`), SessionEnd가 모두 기대한 때에 왔다. Notification은 오지 않았다.
- Stop에 `{"decision":"block","reason":…}`으로 두 번 되돌리자 에이전트가 이유를 받아 이어서 작업했다. 되돌린 뒤 Stop의 `stop_hook_active`는 `false, true, true`였다.
- 훅 서버를 끈 상태에서도 세션이 계속됐다(연결 실패는 비차단 오류).
- 본문에 `session_id`, `transcript_path`, `cwd`, `prompt_id`, `permission_mode`, `hook_event_name`이 공통으로 들어 있다. `permission_mode`로 실제 권한 모드를 알 수 있다(S4 참고).
- `AskUserQuestion` 화면은 번호 목록에 "Type something.", "Chat about this" 항목이 붙고, 아래에 "Enter to select · ↑/↓ to navigate · Esc to cancel"이 나온다.

---

## S3. 스킬 시작과 재개

**확인할 것:** `--add-dir`로 추가한 Work 디렉터리의 스킬이 첫 프롬프트로 시작되는가. `disable-model-invocation: true`가 에이전트의 자동 호출을 막는가. `--resume`으로 대화를 이을 수 있는가.

**절차**

1. Work 디렉터리에 `.claude/skills/relay-test/SKILL.md`(`disable-model-invocation: true`)와 `relay-other`를 둔다.
2. worktree를 작업 디렉터리로 두고 실행한다.
   ```
   claude --dangerously-skip-permissions --session-id <uuid> --add-dir <work 디렉터리> --settings <task 설정> "/relay-test 이 task의 컨텍스트: <context.md 경로>"
   ```
3. `relay-test`가 바로 시작되는지 확인한다.
4. 에이전트가 `relay-other`를 스스로 부르지 않는지 확인한다.
5. 메인 체크아웃에만 있는 프로젝트 스킬이 worktree 세션에서 보이는지 기록한다(D32의 전제).
6. `/compact` 뒤에도 스킬 본문(공통 종료 절차 포함)이 남아 있는지 확인한다(D31).
7. 세션을 끝내고 같은 옵션에 `--resume <uuid>`를 붙여 다시 연다. 대화가 이어지는지 확인한다.

**성공 기준**

- 첫 프롬프트로 `relay-test`가 시작된다.
- 에이전트가 다른 relay 스킬을 스스로 부르지 않는다.
- 압축 뒤에도 종료 절차를 따른다.
- `--resume`으로 대화가 이어진다.

**실패하면 바꿀 설계**

- `--add-dir` 스킬이 읽히지 않으면: 스킬 배포 위치(D32)를 다시 정한다.
- 첫 프롬프트로 시작되지 않으면: 첫 프롬프트 형식(D19, 5.6.3)을 다시 정한다.
- 압축 뒤 절차가 사라지면: 공통 종료 절차의 분량(D31)을 줄인다.

**결과**

| 날짜 | Claude Code 버전 | OS | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-26 | 2.1.283 | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | 일부 실패 | `/compact` 뒤 스킬 끝부분 유지 실패. 실행 #6 |

**관찰 (2026-09-26, 러너, 실행 #6)**

- `--add-dir`로 추가한 Work 디렉터리의 스킬이 첫 프롬프트로 시작됐다.
- `disable-model-invocation: true` 스킬을 에이전트가 스스로 부르지 않았다(인사를 해도 `relay-other`가 실행되지 않음).
- 메인 체크아웃에만 둔(커밋하지 않은) 프로젝트 스킬이 worktree 세션에서도 실행됐다. D32의 전제와 맞다.
- 같은 옵션에 `--resume <id>`를 붙여 다시 열자 대화가 이어졌다.
- **`/compact` 뒤 스킬 끝부분의 지시를 따르지 못했다.** 끝에 둔 표식(ZEBRA-7731)을 물었더니 다른 답을 했다. 시험용 스킬의 분량(약 60줄의 채움 글)이 5,000토큰을 넘었는지, 압축 뒤 스킬이 다시 붙지 않은 것인지는 아직 구분하지 못했다. D31의 전제와 관련되므로 추가 확인이 필요하다.

---

## S3b. `/compact` 뒤 짧은 스킬 본문 유지

**확인할 것:** S3에서 `/compact` 뒤 긴 스킬의 끝부분 지시를 잊었다. 원인이 "스킬이 5,000토큰을 넘음"인지 "압축 뒤 스킬 본문이 다시 붙지 않음"인지 가른다(D31).

**절차**

1. 끝에 종료 표식을 둔 짧은 스킬(1,000토큰 안쪽)을 첫 프롬프트로 시작한다.
2. 표식을 묻지 않은 채 `/compact`를 실행한다.
3. 스킬의 종료 표식을 묻는다.

**성공 기준:** 압축 뒤에도 표식을 답한다.

**실패하면 바꿀 설계**

- 짧은 스킬은 통과하면: S3 실패는 분량 탓으로 본다. D31의 5,000토큰 목표를 유지한다.
- 짧은 스킬도 실패하면: 압축 뒤 스킬이 다시 붙는다는 D31의 전제를 버린다. 종료 절차를 `context.md`에도 두고, 압축 뒤 다시 읽게 하는 대비책을 정한다.

**결과**

| 날짜 | Claude Code 버전 | OS | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-26 | 2.1.283 | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | 통과 | sonnet, effort low. 실행 #7 |

**관찰 (2026-09-26, 러너, 실행 #7)**

- 본문 228자인 짧은 스킬은 `/compact` 뒤에도 끝부분(종료 절차)의 지시를 따랐다. 압축 뒤 스킬 본문이 다시 붙는다는 D31의 전제는 맞다.
- S3의 긴 시험용 스킬(채움 글 약 60줄)에서 끝부분을 잊은 원인은 분량으로 보인다. 다만 그 스킬이 5,000토큰을 실제로 넘었는지는 재지 않았다. D31에 따라 스킬을 만들다 5,000토큰을 넘게 되면 사람에게 알린다.

## S4. 권한 확인을 끈 모드와 deny 규칙

**확인할 것:** 권한 확인을 끈 모드에서 deny 규칙이 어디까지 막는가(6.1, D91). 조직 설정으로 이 모드가 막혔을 때 앱이 알아챌 수 있는가.

**절차**

1. task 설정에 deny 규칙을 넣는다: `Bash(git push*)`, `Bash(gh pr*)`, 앱 소유 파일 `Edit(//…)`.
2. 에이전트에게 다음을 시키고 결과를 기록한다.

   | 시도 | 기대(공식 문서 기준) |
   |---|---|
   | `git push` | 막힘 |
   | `gh pr create` | 막힘 |
   | 파일 도구로 `work.json` 편집 | 막힘 |
   | `echo x > work.json` | 막힘 |
   | Python 스크립트로 `work.json` 쓰기 | 막히지 않음 |
   | `sh -c "git push"` | 막히지 않음 |

3. 앱의 해시 확인(D91)이 2의 우회 편집(Python 스크립트)을 잡아내는지 확인한다.
4. 관리 설정에 `permissions.disableBypassPermissionsMode: "disable"`을 넣고 실행한다. 출력과 종료 코드를 기록한다.

**성공 기준**

- 결과가 표의 기대와 같다.
- 우회 편집을 해시 확인이 잡아낸다.
- 모드가 막혔을 때 앱이 구분할 수 있는 신호(종료 코드나 출력)가 있다.

**실패하면 바꿀 설계**

- 직접 부른 `git push`도 막히지 않으면: D17의 방어 방식을 다시 정한다(예: PreToolUse 훅으로 차단).
- 모드 차단을 구분할 수 없으면: 7절의 안내를 일반 실행 실패 안내로 바꾼다.

**결과**

| 날짜 | Claude Code 버전 | OS | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-26 | 2.1.283 | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | 통과(문서와 일치) / 모드 차단 시 동작은 예상과 다름 | 실행 #6 |

**관찰 (2026-09-26, 러너, 실행 #6)**

- `git push`, 파일 도구 편집, `echo > work.json`은 막혔다. Python 스크립트 쓰기와 `sh -c "git push"`는 막히지 않았다. 공식 문서 설명(design 6.1)과 같다.
- 앱의 해시 확인은 Python 스크립트로 바꾼 `work.json`을 잡아냈다.
- deny로 막힌 명령도 PreToolUse 훅은 먼저 온다. 막히면 PostToolUse는 오지 않는다. `gh pr create`도 같은 모양이었다(gh 로그인이 없어 확정은 아님).
- **관리 설정으로 권한 확인 끈 모드를 막으면, 세션이 실패하지 않고 auto 모드로 실행된다.** 화면에 "Auto mode is now Claude Code's default permission mode"가 뜨고 상태 줄이 `auto mode on`이다. design 7절의 "task 실행이 실패한다"는 틀렸다. 앱은 훅 본문의 `permission_mode`로 알아챌 수 있다.

---

## S5. 첫 실행 창

**확인할 것:** 권한 확인 끈 모드 경고와 폴더 신뢰 창이 언제 뜨는가. 창이 뜰 때 첫 프롬프트가 사라지지 않는가.

**절차**

1. Claude Code 사용자 설정을 비운 상태에서 relay 방식으로 실행한다. 권한 확인 끈 모드 경고가 뜨는지, 수락이 저장되어 다음에는 뜨지 않는지 확인한다.
2. 새 worktree를 만들어 실행한다. 폴더 신뢰 창이 뜨는지 확인한다.
3. 두 번째 Work의 새 worktree에서 다시 실행한다. 신뢰 창이 또 뜨는지 확인한다.
4. `--add-dir`로 추가한 Work 디렉터리에도 신뢰 확인이 있는지 기록한다.
5. 창을 수락한 뒤 인자로 준 첫 프롬프트(`/relay-<스킬> …`)가 실행되는지 확인한다.

**성공 기준**

- 창이 뜨는 조건을 기록했다.
- 창을 수락한 뒤 첫 프롬프트가 실행된다.

**실패하면 바꿀 설계**

- worktree마다 신뢰 창이 떠서 불편하면: 9절의 "폴더 신뢰 창 자동 처리"를 검토한다(D69 수정).
- 창을 수락한 뒤 첫 프롬프트가 사라지면: 시나리오 2-5의 실행 방법을 다시 정한다(예: 첫 실행에만 사람이 스킬을 직접 입력하도록 안내).

**결과**

| 날짜 | Claude Code 버전 | OS | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-26 | 2.1.283 | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | 통과 | 아래 관찰 참고. 실행 #4 |

**관찰 (2026-09-26, 러너)**

- 깨끗한 프로필에서 첫 실행 때 뜬 창(순서대로): 테마 선택 → API 키 사용 승인(`ANTHROPIC_API_KEY`를 쓸 때만) → 보안 안내(Enter) → 폴더 신뢰(`No, exit`가 기본) → 권한 확인 끈 모드 경고(`No, exit`가 기본).
- 창을 모두 수락한 뒤, 인자로 준 첫 프롬프트(`/relay-mark …`)가 그대로 실행됐다.
- 같은 worktree에서 다시 실행하거나, 같은 레포의 새 worktree에서 실행했을 때는 창이 하나도 뜨지 않았다. 폴더 신뢰 창이 Work마다 뜨지는 않는다.
- 폴더 신뢰와 권한 확인 끈 모드 경고는 기본 선택이 "종료"다. 사람이 첫 실행 때 한 번 직접 수락해야 한다는 시나리오 0의 전제(D69)와 맞다.
- Windows 콘솔은 선택 목록의 현재 항목을 `>`로 그리고, API 키·폴더 신뢰·모드 경고 목록에는 번호가 없다.

---

## S6. 강제 종료 뒤 재개

**확인할 것:** [즉시 중단]은 세션을 프로세스 트리째 종료한다(시나리오 3-4, 7절). 그렇게 끝낸 세션을 같은 옵션과 `--resume <세션 id>`로 열면 대화가 이어지는가. S3는 `/exit`로 끝낸 세션만 확인했다.

**절차**

1. relay 방식(`--session-id <uuid>`, `--settings`, `--add-dir`)으로 세션을 시작하고, 표식이 든 요청을 보내 답을 받는다.
2. 에이전트가 턴을 끝낸 뒤(Stop) 프로세스 트리를 종료한다(`taskkill /T /F`).
3. 같은 옵션에 `--resume <uuid>`를 붙여 다시 연다. 표식을 묻는다.
4. 작업 중(턴이 끝나기 전)에 트리를 종료한 경우도 2~3을 한 번 더 한다.
5. 다시 연 세션의 훅 신호(UserPromptSubmit, Stop)가 오는지 기록한다.

**성공 기준**

- 턴이 끝난 뒤 종료한 세션을 `--resume`으로 열면 표식을 답한다.
- 작업 중에 종료한 세션도 열린다. 마지막 턴이 얼마나 남는지는 기록만 한다.

**실패하면 바꿀 설계**

- 이어지지 않으면: [즉시 중단]의 종료 방법과 [재개](시나리오 3-4)를 사용자와 다시 정한다.

**코드:** `spikes/s6-resume.mjs`(`docs/implementation.md` I31). 다시 열 때는 `--session-id`와 첫 프롬프트를 빼고 나머지 옵션(`--dangerously-skip-permissions`, `--add-dir`, `--settings`)을 다시 준다. 대화가 없는 세션 id로 `--resume`하면 어떻게 되는지도 관찰한다. Linux에는 `taskkill`이 없어 강제 종료는 프로세스 그룹에 SIGKILL을 보내 흉내 낸다. node-pty `kill()`의 기본 신호인 SIGHUP은 강제 종료가 아니다(받은 claude가 SessionEnd 훅을 보내고 정상으로 끝남).

**결과**

| 날짜 | Claude Code 버전 | OS | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-26 | 2.1.283 | Linux 클라우드 컨테이너(Claude Code 웹 세션), 예비 확인 | 통과(판정 흐림) | sonnet, effort medium. 에이전트가 표식을 자동 메모리에 적어, 다시 연 세션의 답이 대화가 아니라 메모리에서 왔을 수 있다. 아래 줄에서 자동 메모리를 끄고 다시 돌렸다 |
| 2026-09-26 | 2.1.283 | Linux 클라우드 컨테이너(Claude Code 웹 세션), 예비 확인 | 통과 | sonnet, effort medium, 자동 메모리 끔(`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`). 강제 종료는 프로세스 그룹 SIGKILL로 흉내 냈다. Windows(`taskkill /T /F`)에서도 같은지는 [실기]에서 본다 |

**관찰 (2026-09-26, Linux 컨테이너, 예비 확인)**

레포에 Claude 인증 secret이 없어 러너(`spikes.yml`) 대신 Claude Code 웹 세션의 Linux 컨테이너에서 실제 `claude`로 돌렸다. 세션의 환경 변수는 넘기지 않았고(`env -i`), 따로 둔 설정 폴더(`CLAUDE_CONFIG_DIR`)를 썼다(`spikes/README.md`).

- **턴이 끝난 뒤 강제 종료:** SessionEnd 훅은 오지 않았다. 같은 옵션에 `--resume <id>`를 붙여 다시 열자 2.3초 만에 입력을 받았고, 화면에 앞의 대화가 보였고, 표식을 답했다. 다시 연 세션의 훅 본문은 `session_id`와 `transcript_path`가 처음과 같았고 `permission_mode`는 `bypassPermissions`였다. UserPromptSubmit과 Stop 훅이 왔다.
- **작업 중(도구 실행 중) 강제 종료:** 다시 열렸고, 사람이 입력하기 전에는 스스로 이어서 작업하지 않았다(훅이 오지 않음). 끊긴 턴의 사람 메시지와 끝난 도구 호출은 대화에 남았다. 끊긴 도구 호출에는 결과 대신 "[Tool call interrupted: the session ended before this call's result was recorded, so its outcome is unknown. …]"가 붙고, 뒤에 "No response requested."라는 답이 들어갔다. 에이전트는 두 표식과 끊긴 명령을 답하고, 그 명령의 결과는 모른다고 했다. Claude Code 문서(sessions, "What a resumed session restores")의 설명과 같다.
- **대화가 없는 세션:** 메시지를 보내기 전에 강제 종료한 세션 id(1차: 폴더 신뢰 창이 떠 있을 때, 2차: 입력을 기다릴 때)로 `--resume`하면 첫 실행 창을 거친 뒤 "No conversation found with session ID: <id>"를 출력하고 종료 코드 1로 끝났다.
- **Linux의 프로세스 그룹 SIGKILL:** claude는 Bash 도구의 셸과 그 명령을 자기와 다른 프로세스 그룹으로 띄웠다. 그래서 claude의 그룹에 SIGKILL을 보내도 `bash`와 명령(`node`)이 남았다(스파이크가 치움). Windows의 `taskkill /T`는 부모 관계로 트리를 따라가므로 해당이 없을 것으로 보지만, 도구가 돌 때 트리 종료 뒤 남는 프로세스가 없는지는 [실기]에서 본다.
- **렌더러:** 시작하는 중에 강제 종료한 다음 실행은 "fullscreen renderer didn't finish starting last time"을 알리고 기본(classic) 렌더러로 떴고, 여러 번 되풀이되자 전체 화면 렌더러를 껐다고 알렸다. S1의 관찰(실행 #5)과 같다.
- **자동 메모리:** 1차 실행에서 "기억해 둬"라는 요청을 받은 에이전트가 표식을 자동 메모리(`<설정 폴더>/projects/<레포>/memory/`)에 적었다. 자동 메모리는 기본으로 켜져 있고 레포(worktree 공유)마다 쌓여 task와 Work 사이를 `context.md` 밖으로 잇는다(Claude Code 문서 memory). 앱은 task 세션에서 자동 메모리를 끈다(D113).

---

## S7. GitHub 연동

**확인할 것:** PR 진행(설계 시나리오 10)이 쓰는 GitHub 동작을 앱이 gh로 할 수 있는가. 결과가 설계의 가정(D157~D161, D172, D175~D179, D193, D194)과 같은가.

**환경:** 시험용 레포 [`CheongMyungJ/relay-v2-test`](https://github.com/CheongMyungJ/relay-v2-test)에서 한다. CI를 일부러 실패시키는 스위치, 봇 코멘트 워크플로, 토큰 권한은 그 레포의 README에 있다. relay-v2 레포에는 시험 PR을 만들지 않는다(`docs/implementation.md` I42). gh와 GitHub의 동작은 OS와 상관없으므로 Windows 러너가 아니어도 된다. 결과 표에는 gh 버전을 적는다. Claude Code 웹 세션에서는 GitHub GraphQL이 막혀 있어(2026-09-28 확인), GraphQL을 쓰는 gh의 PR 명령(`gh pr create`, `gh pr view` 등)이 돌지 않는다. 그래서 러너나 사람의 PC에서 한다. 러너에서 할 때는 시험용 레포의 토큰 secret(I43)만 있으면 되고 Claude 인증 secret은 필요 없다.

**절차**

1. 시험용 브랜치를 push하고 `gh pr create`로 PR을 만든다.
2. PR 상태를 읽는다: 열림·머지·닫힘, head 커밋, 머지 가능 여부, 리뷰 상태, 체크 상태. 실패한 체크(GitHub Actions)에서 실패한 스텝의 로그 끝부분을 읽는다. 작업 로그 전체의 끝에는 정리 단계(Post job cleanup)가 오므로(시험용 레포의 스모크 시험, 2026-09-28), 실패한 스텝만 가려 읽는 방법(`gh run view --log-failed` 등)을 확인한다.
3. 코멘트를 읽는다: 리뷰 본문, 인라인 코멘트와 기존 스레드의 답글, PR 대화 코멘트. 소유자, 협업자, 협업자가 아닌 계정, 봇(GitHub 앱)이 하나씩 단 코멘트에서 작성자 관계(author association)와 봇 여부가 무엇으로 오는지 기록한다.
4. 답글을 게시한다: 인라인 코멘트 스레드의 답글, PR 대화 코멘트. 본문 끝의 보이지 않는 표시(D194)가 API로 읽은 본문에 그대로 남는지, 웹 화면에는 보이지 않는지, 그 표시로 게시한 답글을 찾을 수 있는지 본다. 앱이 게시한 답글을 다음 읽기에서 가려낼 수 있는지 본다.
5. 실패한 체크를 다시 실행한다.
6. 머지한다: 레포가 허용하는 머지 방식을 읽고, 사람이 본 head 커밋이 아니면 머지되지 않게 하는 방법을 확인한다. 머지 뒤 원격 브랜치를 지운다. worktree에 체크아웃된 로컬 브랜치가 있을 때 gh가 어떻게 하는지도 본다.
7. 기준 브랜치를 앞서 나가게 해 충돌을 만들고, 충돌이 PR 상태에 어떻게 보이는지 기록한다.
8. PR 브랜치에 GitHub에서 커밋을 더한다(리뷰 제안 커밋 적용이나 웹 편집). 로컬에서 원격 head와 비교해 fast-forward로 받는 절차와, 로컬에도 커밋이 있을 때 일반 push가 거절되는 모양을 기록한다(D193).
9. PR 하나를 2분마다 읽을 때 드는 API 호출 수와 한도를 기록한다.

**성공 기준**

- 2~9를 gh(필요하면 `gh api`)로 할 수 있다.
- 작성자 관계로 소유자·조직 구성원·협업자와 나머지를, 봇과 사람을 가를 수 있다(D160, D161).
- head 커밋을 고정한 머지가 된다(D176).
- 보이지 않는 표시로 앱이 게시한 답글을 찾을 수 있다(D194).
- 2분 읽기가 한도 안이다(D158).

**실패하면 바꿀 설계**

- 작성자 관계로 가를 수 없으면: D160을 허용 목록 방식으로 바꿀지 사용자와 다시 정한다.
- head 커밋을 고정한 머지가 안 되면: 머지 직전에 head를 다시 읽어 비교하는 방식과 그 틈을 사용자와 다시 정한다(D176).
- 한도를 넘으면: 읽기 주기(D158)를 사용자와 다시 정한다.
- 체크 재실행이 안 되면: D175를 사용자와 다시 정한다.
- 표시가 본문에 남지 않거나 그것으로 답글을 찾을 수 없으면: 게시 결과를 모르는 요청의 확인 방법(D194)을 사용자와 다시 정한다.

**코드:** `spikes/s7-github.mjs`(`docs/implementation.md` I47). `spikes` 워크플로의 Linux 작업에서 start → 사람의 코멘트 → finish 차례로 돌고, 남은 것은 cleanup이 치운다. 시험 PR은 시험용 레포의 main에서 만든 임시 기준 브랜치(`s7/<run>/base`)에 열어 main을 건드리지 않는다. 돌리는 방법과 사람이 할 일은 `spikes/README.md`에 있다.

**결과**

| 날짜 | gh 버전 | 환경 | 결과 | 메모 |
|---|---|---|---|---|
| 2026-09-29 | 2.101.0 | GitHub Actions ubuntu-latest (ubuntu24 20260920.314.1), git 2.55.0 | 통과(작성자 관계 일부는 확인 못 함) | 실행 #8·#9·#12·#14(start), #11·#13·#15(finish), #10(cleanup). 다른 계정이 없어 협업자와 협업자가 아닌 계정의 코멘트(절차 3의 사람 단계)는 하지 않았다. 새 head의 체크가 비어 있는 틈을 보고 D196을 정했다 |

**성공 기준 판정**

| 성공 기준 | 판정 | 근거 |
|---|---|---|
| 2~9를 gh(필요하면 `gh api`)로 할 수 있다 | 통과 | 절차마다 쓴 명령은 아래 관찰에 있다. PR 상태, 체크, 재실행, 머지는 gh 명령으로, 코멘트 목록과 답글은 `gh api`(REST)로 했다 |
| 작성자 관계로 소유자·조직 구성원·협업자와 나머지를, 봇과 사람을 가를 수 있다(D160, D161) | 일부 확인 | 소유자의 코멘트는 OWNER, 봇(github-actions)의 코멘트는 REST `user.type` Bot과 관계 NONE이었다. 협업자와 협업자가 아닌 계정은 사람 단계를 하지 않아 확인 못 함. 조직 구성원(MEMBER)은 시험용 레포가 개인 레포라 확인할 수 없다. 값의 뜻은 아래 관찰 3의 GitHub 스키마 설명을 따른다 |
| head 커밋을 고정한 머지가 된다(D176) | 통과 | `gh pr merge <n> --repo <레포> --squash --match-head-commit <sha>`. 옛 head를 주면 머지되지 않고 PR이 열린 채 남았고, 지금 head를 주면 머지됐다 |
| 보이지 않는 표시로 앱이 게시한 답글을 찾을 수 있다(D194) | 통과 | 표시는 API가 주는 본문에 그대로 있고 웹이 그리는 본문(`body_html`)에는 없었다. 코멘트 목록의 본문에서 표시로 답글을 찾았다 |
| 2분 읽기가 한도 안이다(D158) | 통과 | 한 번 읽기가 GraphQL 1점과 REST 3번이다. 2분마다 읽으면 시간당 30점과 90번으로, 한도(각 5,000)의 2%다 |

**관찰 (2026-09-29, 러너)**

1. **PR 만들기:** `gh pr create --repo <레포> --base <기준> --head <브랜치> --title … --body-file …`는 TTY가 아니어도 PR 주소를 표준 출력에 찍었다.
2. **상태 읽기**
   - `gh pr view <n> --repo <레포> --json state,headRefOid,baseRefOid,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,…` 한 번(GraphQL 요청 1번)으로 열림·머지·닫힘(`state`의 OPEN, MERGED, CLOSED), head, 머지 가능 여부, 리뷰 상태, 체크를 읽는다. 리뷰 규칙이 없는 레포라 `reviewDecision`은 빈 문자열이었다.
   - PR을 만든 직후에는 `mergeable`과 `mergeStateStatus`가 UNKNOWN이었다. 새 head의 체크는 PR을 만든 뒤 0.7~3.5초, push한 뒤 4.8~6.7초에 나타났다(실행 #8, #9, #12, #14). 그전에는 체크 목록이 비어 있는데도 MERGEABLE, CLEAN이 나올 때가 있었다. 실행 #9에서는 만든 뒤 0.6초에 MERGEABLE/CLEAN과 체크 0개, 2.1초에 체크 1개였고, push한 뒤 4.7초에 MERGEABLE/CLEAN과 체크 0개, 6.3초에 체크 1개였다. 실행 #12에서는 만든 뒤 1.8초까지, push한 뒤 3.5초에 MERGEABLE/CLEAN과 체크 0개였고, 체크는 3.5초, 4.8초에 나타났다. D196의 근거다.
   - 체크가 없을 때 `gh pr checks`는 `--json`을 줘도 종료 코드 1과 "no checks reported on the '<브랜치>' branch"를 냈다. 체크가 있으면 `--json`은 실패와 대기에 상관없이 종료 코드 0이다. 종료 코드 1(실패)과 8(대기)은 표 출력에만 쓴다(cli/cli v2.101.0 `pkg/cmd/pr/checks/checks.go`).
   - 체크의 링크(`gh pr checks`의 `link`, statusCheckRollup의 `detailsUrl`)는 `…/actions/runs/<실행 id>/job/<작업 id>`라 실행과 작업을 안다. Actions 체크는 statusCheckRollup의 CheckRun에 `workflowName`이 있다.
   - **실패한 스텝의 로그:** `gh run view <실행 id> --log-failed`(`--job <작업 id>`도 같음)는 실패한 스텝(`스위치 확인`)의 줄만 `<작업>\t<스텝>\t<시각> <줄>` 모양으로 줬다. 끝은 `##[error]…` 두 줄이었고 정리 단계는 없었다. 스크립트 줄에는 색 제어 문자가 `^[[36;1m`처럼 남는다. 실행의 로그 zip에 스텝별 파일이 없으면 gh는 작업 로그 전체를 스텝 이름 "UNKNOWN STEP"으로 준다(cli/cli `pkg/cmd/run/view/logs.go`). 이번에는 스텝별 파일이 있었다.
   - REST 작업 로그(`actions/jobs/{id}/logs`)에는 정리 단계까지 들어 있다. 색 제어 문자가 있어 `gh api`는 `--allow-escape-sequences`를 줘야 출력했다. "Post job cleanup." 앞에서 자르면 끝이 실패한 스텝의 오류였다.
   - 체크의 annotation(`check-runs/{작업 id}/annotations`)에는 `::error::`의 문구와 "Process completed with exit code 1."이 failure로 왔다.
3. **코멘트 읽기**
   - REST 목록 셋: 리뷰 `pulls/{n}/reviews`, 인라인 코멘트 `pulls/{n}/comments`, 대화 코멘트 `issues/{n}/comments`. 항목마다 `author_association`, `user.login`, `user.type`(User, Bot)이 있다. 스레드의 답글은 `in_reply_to_id`로 스레드의 첫 코멘트를 가리킨다.
   - 소유자(토큰의 계정)가 단 리뷰, 인라인 코멘트, 답글, 대화 코멘트는 모두 OWNER였다. github-actions(시험용 레포의 봇 코멘트 워크플로)는 REST에서 login `github-actions[bot]`, `user.type` Bot, 관계 NONE이었다. GraphQL(`gh pr view --json comments,reviews`)은 봇의 login을 `github-actions`로 주고 봇인지 알려 주지 않는다(gh는 PR 작성자에만 `is_bot`을 붙인다. cli/cli `api/queries_issue.go`). 인라인 코멘트도 주지 않는다.
   - 인라인 스레드에 답글을 달면 본문이 빈 리뷰(state COMMENTED)가 하나 더 생기고, 답글의 `pull_request_review_id`가 그 리뷰를 가리킨다. 앱이 게시한 답글도 같았다.
   - 코멘트를 고쳐도 id는 그대로고 `updated_at`만 바뀌었다. `issues/{n}/comments?since=<때>`는 그 뒤에 고친 코멘트를 돌려줬다.
   - 협업자와 협업자가 아닌 계정은 사람 단계를 하지 않아 확인 못 함. 앱의 거르기를 흉내 내면(finish) 소유자의 것은 받음, 봇의 것은 받지 않음(받을 봇 목록이 빔)이었다.
   - 작성자 관계의 값과 뜻(GitHub GraphQL 스키마의 CommentAuthorAssociation. shurcooL/githubv4 `enum.go`가 스키마에서 옮긴 설명): OWNER "Author is the owner of the repository.", MEMBER "Author is a member of the organization that owns the repository.", COLLABORATOR "Author has been invited to collaborate on the repository.", CONTRIBUTOR, FIRST_TIME_CONTRIBUTOR, FIRST_TIMER, MANNEQUIN, NONE.
4. **답글과 보이지 않는 표시**
   - 인라인 스레드의 답글(`POST pulls/{n}/comments/{id}/replies`)과 대화 코멘트(`POST issues/{n}/comments`)는 응답에 코멘트 id를 준다. 게시하자마자 `pr-items.json`에 적을 수 있다(D194). `gh pr comment`는 코멘트 주소(`…#issuecomment-<id>`)를 찍는다.
   - 본문 끝의 `<!-- relay:<work-id>/<항목 id>/<라운드> -->`는 REST와 GraphQL의 본문에 그대로 남았고, 웹이 그리는 본문(`Accept: application/vnd.github.full+json`의 `body_html`, `body_text`)에는 없었다. 목록의 본문에서 표시로 게시한 답글을 찾았다. 웹 화면을 눈으로 보는 확인은 사람 단계와 함께 하지 않았다.
   - 답글을 게시한 뒤의 읽기에서 새로 생긴 것은 앱의 답글 둘과 본문이 빈 리뷰 하나였다. 적어 둔 id·표시와 "본문이 빈 리뷰는 항목이 아님"으로 모두 가렸다.
5. **실패한 체크 다시 실행:** `gh run rerun <실행 id> --repo <레포> --failed`(REST `rerun-failed-jobs`)로 실패한 작업만 다시 돌았고, 두 번째 시도가 통과했다(시험용 레포의 `ci-flaky` 스위치). 다시 돈 뒤 statusCheckRollup과 `gh pr checks`에는 새 시도의 체크 하나만 있었다.
6. **머지**
   - 허용하는 머지 방식은 `gh repo view <레포> --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`로 읽는다(REST는 `allow_merge_commit` 등). `viewerDefaultMergeMethod`도 있다. MERGE였다가 실행 #11에서 squash로 머지한 뒤 SQUASH로 바뀌었다.
   - `gh pr merge <n> --repo <레포> --squash --match-head-commit <옛 head>`는 종료 코드 1과 "GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)"로 실패했고 PR은 열린 채였다. REST `PUT pulls/{n}/merge`에 옛 `sha`를 주면 409와 같은 문구였다. 지금 head를 주면 머지됐다. gh는 이 값을 GraphQL `mergePullRequest`의 `expectedHeadOid`로 보낸다(cli/cli `pkg/cmd/pr/merge/http.go`).
   - TTY가 아니면 `gh pr merge`는 성공해도 아무것도 찍지 않았다(종료 코드 0). 성공 문구는 TTY일 때만 찍는다(cli/cli `pkg/cmd/pr/merge/merge.go`의 `infof`).
   - `--repo`를 준 머지는 worktree와 로컬 브랜치를 건드리지 않았다. 레포 설정 `delete_branch_on_merge`가 꺼져 있어 머지 뒤 원격 head 브랜치가 남았고, `git push origin --delete <브랜치>`로 지웠다.
   - `--delete-branch`를 주면: `--repo`와 함께면 원격 브랜치만 지웠다(로컬 그대로). `--repo` 없이 메인 체크아웃에서 부르면, head 브랜치가 체크아웃된 다른 worktree를 `git worktree remove`로 지우고 로컬 브랜치도 지웠다(출력 없음, 종료 코드 0). 소스를 보면, 부른 곳이 그 브랜치의 worktree(메인이 아님)면 로컬 삭제를 건너뛰고, 메인 worktree에서 불렀는데 메인이 그 브랜치면 기준 브랜치로 바꾼 뒤 지운다(cli/cli `merge.go`의 `deleteLocalBranch`).
   - 머지된 PR은 `state` MERGED와 `mergedAt`, `mergeCommit`으로, 닫은 PR은 CLOSED로, 다시 연 PR은 OPEN으로 읽혔다(D179).
7. **충돌:** 기준 브랜치에 PR과 같은 자리를 바꾼 커밋을 넣자 `mergeable` CONFLICTING, `mergeStateStatus` DIRTY(REST `mergeable` false, `mergeable_state` dirty)가 됐다. 이때 PR의 기준 커밋(REST `base.sha`, GraphQL `baseRefOid`)은 기준 브랜치의 새 커밋이 아니라 PR을 만들 때의 커밋이었고, PR 브랜치에 push한 뒤에야 바뀌었다. 기준 브랜치를 병합해 푼 커밋은 일반 push로 올라갔고 MERGEABLE로 돌아왔다.
8. **원격 PR 브랜치 맞추기**
   - GitHub에서 한 커밋(contents API. 웹 편집처럼 GitHub가 만드는 커밋)을 fetch한 뒤 `git merge-base --is-ancestor HEAD origin/<브랜치>`(종료 코드 0)로 원격만 앞선 것을 알고 `git merge --ff-only`로 받았다.
   - GitHub의 [Update branch](`PUT pulls/{n}/update-branch`)는 202 "Updating pull request branch."를 돌려주고 몇 초 뒤 head가 바뀌었다. 받은 커밋 가운데 두 번째 부모가 기준 브랜치 커밋인 병합 커밋으로 기준 브랜치 병합을 가렸다(`git rev-list --parents`).
   - 로컬에도 커밋이 있으면 일반 push가 거절됐다. fetch 전에는 `[rejected] (fetch first)`, fetch 뒤에는 `[rejected] (non-fast-forward)`였고 둘 다 종료 코드 1이다. `--porcelain`을 주면 `!<탭><ref>:<ref><탭>[rejected] (…)` 줄로 나온다. fetch 뒤 두 방향 조상 검사가 모두 1이면 갈라진 것이다. 원격을 병합한 뒤 일반 push가 됐다.
   - 리뷰 제안 커밋 적용은 하지 않았다.
9. **API 한도:** 앱이 2분마다 할 한 번 읽기는 `gh pr view --json …` 하나(GraphQL 1점)와 REST 목록 셋(리뷰, 인라인 코멘트, 대화 코멘트. 100개까지는 한 쪽)이다. 응답 머리글(`X-Ratelimit-Used`)로 보면 한 번 읽기마다 graphql이 1, core가 3 늘었다. 이 토큰(fine-grained)의 한도는 core와 graphql 모두 시간당 5,000이다. PR 하나를 2분마다 읽으면 시간당 graphql 30, core 90으로 한도의 2%다. 새 CI 실패를 볼 때만 드는 `gh run view --log-failed`는 REST 4번과 로그 zip 내려받기 1번이었다. `rate_limit`의 `used`는 첫 실행에서 읽기 전후가 같게 나와(0) 머리글로 쟀다.

**설계의 가정과 비교**

| 결정 | 가정 | 결과 |
|---|---|---|
| D157 | 항목은 CI 실패, 리뷰 본문과 인라인 코멘트(기존 스레드는 새 답글), 대화 코멘트, 충돌, 원격과 갈라짐 | 모두 gh로 읽힌다. 인라인 답글이 만드는 본문이 빈 리뷰는 리뷰 본문이 없으므로 항목이 아니다. 새 답글은 `in_reply_to_id`로 스레드를 안다 |
| D158 | 2분 주기가 한도 안 | 맞다(시간당 2%) |
| D159 | 재시작 때 한 번 읽기 | 읽기는 목록 전체를 읽어 앞 읽기가 없어도 같다. 앱의 동작이라 시험하지 않았다 |
| D160 | 작성자 관계로 소유자·조직 구성원·협업자를 가림 | OWNER만 확인했다. COLLABORATOR와 나머지는 확인 못 함. MEMBER는 조직 레포가 있어야 한다 |
| D161 | 봇을 가리고 설정한 봇만 받음 | REST `user.type` Bot으로 가린다. 봇 이름은 REST가 `github-actions[bot]`, GraphQL이 `github-actions`로 모양이 달라, 설정에 적는 이름의 모양을 D197로 정했다 |
| D172 | 승인 뒤 답글 게시 | 인라인 스레드의 답글과 대화 코멘트를 게시했다 |
| D175 | GitHub Actions 체크만 다시 실행 | `gh run rerun --failed`가 된다. Actions 체크는 링크가 `/actions/runs/…/job/…`이고 CheckRun에 `workflowName`이 있어 가린다. Actions 밖 체크(커밋 상태)는 이 토큰(Commit statuses 읽기)으로 만들 수 없어 시험하지 않았다 |
| D176 | head를 고정한 머지, 체크가 없으면 통과 | head 고정은 `--match-head-commit`으로 된다. 체크가 없는 틈 때문에 D196을 더했다 |
| D177 | 허용하는 머지 방식에서 고름 | `gh repo view --json …Allowed`로 읽는다 |
| D178 | 머지 뒤 정리 창, 원격 브랜치 삭제는 고름 | 머지는 원격 브랜치를 남긴다(`delete_branch_on_merge`가 꺼져 있을 때). 정리에서 `git push --delete`로 지운다. gh의 `--delete-branch`는 `--repo` 없이 쓰면 worktree를 지운다 |
| D179 | 밖에서 머지·닫힘을 읽음 | `state`가 MERGED, CLOSED이고, 다시 열면 OPEN이다 |
| D193 | 원격만 앞서면 fast-forward, 갈라지면 항목, push 거절 | 맞다. update-branch의 병합 커밋도 두 번째 부모로 가린다 |
| D194 | 답글의 id를 바로 적고 표시로 찾음 | 맞다. 게시 응답에 id가 있고, 표시는 본문에 남고 화면에는 없다 |

**토큰 권한** (시험용 레포 README의 부탁)

- 쓴 권한: Contents 쓰기(브랜치 push와 삭제, contents API 커밋, 머지, update-branch), Pull requests 쓰기(PR, 리뷰, 인라인 답글), Issues 쓰기(대화 코멘트와 고치기), Actions 쓰기(실패한 작업 다시 실행, 봇 코멘트 워크플로 실행)와 읽기(실행, 작업, 로그). 모든 호출이 성공해 모자란 권한은 없었다.
- Administration(읽기)과 Commit statuses(읽기)가 필요한지는 그 권한을 뺀 토큰으로 시험하지 않아 모른다. 레포 설정의 머지 방식은 읽혔고, Actions 밖 CI는 없었다.

**확인 못 한 것**

- 협업자와 협업자가 아닌 계정의 작성자 관계(사람 단계). 사용자가 따로 한다. start로 PR을 만들고 `spikes/README.md`의 사람 단계를 한 뒤 finish를 돌린다.
- 조직 구성원(MEMBER). 조직이 가진 레포가 있어야 한다.
- 웹 화면에서 표시가 보이지 않는지 눈으로 보기, 리뷰 제안 커밋 적용, Actions 밖 체크(커밋 상태).
