# 스파이크 실행 계획 (M0)

- 목적: 설계가 기대는 가정 가운데 **틀리면 구조가 바뀌는 것**을 코드 작성 전에 확인한다.
- 산출: 스파이크마다 `docs/spikes/results/S<n>.md`(아래 결과 양식)와, 필요하면 design.md 결정 표 갱신.
- 스파이크 코드는 버리는 코드다. `spikes/` 디렉터리에 두고 제품 코드로 옮기지 않는다.

## 0. 공통 준비물

| 항목 | 내용 |
|---|---|
| 장비 | Windows 11 23H2 이상 1대(주), Windows 10 22H2 1대(ConPTY 차이 확인용), macOS 또는 Linux 1대(보조) |
| 도구 | Node LTS, Electron 최신 안정판, `node-pty`(electron-rebuild로 빌드), `@xterm/xterm` + `addon-fit`, `addon-unicode11`, `addon-webgl`, `addon-serialize` |
| CLI | Claude Code 최신 안정판(Windows 네이티브 설치), Git for Windows, `gh`(S1~S4에는 불필요) |
| 입력기 | Windows 기본 Microsoft 한국어 IME |
| 샘플 레포 | 테스트가 있는 작은 Node 레포 1개(vitest), Python 레포 1개(pytest). 알려진 버그를 심은 브랜치 포함 |
| 기록 | 각 스파이크 시작 시 `claude --version`, OS 빌드, Electron/node-pty 버전을 결과에 적는다 |

순서와 시간 상자(기본값): **S1(2일) → S2(1일) → S3(0.5일) → S4(1일)** → S6(3일, S4 이후) → S5(1일, 선택). S1이 실패하면 나머지를 멈추고 대안을 먼저 정한다.

### 결과 양식

```markdown
# S<n> 결과
- 날짜 / 환경(버전들)
- 판정: 통과 | 조건부 통과 | 실패
- 항목별 결과 표 (항목, 기대, 실제, 판정)
- 발견한 제약과 우회 방법
- 설계 반영: (결정 번호, 바뀌는 절)
```

---

## S1. Windows에서 Electron + node-pty + xterm.js로 `claude` TUI 사용

**가정:** CLI를 임베드한 터미널이 네이티브 터미널(Windows Terminal)과 같은 사용성을 준다. (D1, D8, D12의 전제)

**준비:** 최소 Electron 앱 — 창 하나에 xterm 하나, node-pty로 `claude` 실행, 메인↔렌더러 PTY 데이터는 MessagePort. PTY 출력은 `pty.log`로도 저장.

**절차 (항목마다 Windows Terminal에서 같은 동작을 하고 나란히 비교)**

| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 기본 입력, 방향키, 기록 이동 | 프롬프트 입력·편집 |
| 2 | 붙여넣기 | 한 줄, 여러 줄(bracketed paste), 10KB 텍스트 |
| 3 | 중단 키 | 응답 중 Esc, Ctrl+C 1회/2회, 권한 프롬프트에서 Esc |
| 4 | 창 크기 변경 | 응답 스트리밍 중 창 크기 반복 변경 → 화면 깨짐 여부 |
| 5 | **한글 입력** | 조합 중 글자 표시 위치, 조합 중 Enter/Backspace, 빠른 타이핑, 한자 변환 키 |
| 6 | 넓은 문자 렌더링 | 한글/이모지 섞인 출력의 열 정렬(unicode11 addon 유무 비교) |
| 7 | 색과 스타일 | diff 표시, 스피너, 256색/트루컬러 |
| 8 | 스크롤과 선택 복사 | 긴 출력 스크롤, 마우스 선택 → 클립보드 |
| 9 | 장시간 | 1시간 세션 후 메모리, 입력 지연 |
| 10 | 동시 세션 | 세션 3개(= `max_live` 기본값) 동시 스트리밍 시 CPU, 입력 지연 |
| 11 | 읽기 전용 재생 | 세션 종료 후 `pty.log`를 새 xterm에 써서 마지막 화면과 스크롤백 재현 |
| 12 | 종료 처리 | 앱 종료 시 `claude` 자식 프로세스가 남는지(작업 관리자 확인) |

**판정 기준**
- 통과: 1~8, 11, 12가 Windows Terminal과 동등. 9~10은 입력 지연 체감 없음(키 입력→표시 50ms 이내 목표).
- 조건부 통과: 5(한글) 또는 6에 사소한 문제가 있으나 우회 가능(설정, xterm 버전 고정).
- 실패: 1~4 중 하나라도 쓸 수 없는 수준.

**실패 시 대안**
1. 한글 IME 문제 → xterm의 조합 처리 옵션과 버전을 바꿔 재시도. 안 되면 입력 전용 보조 입력창(조합 완료 후 PTY로 전송)을 두는 방안. 단, 이것은 "사람의 입력을 대신 전달"하는 것이지 자동 주입이 아니므로 기각된 대안과 충돌하지 않는다.
2. 렌더링 문제 → webgl/canvas/DOM 렌더러 비교.
3. 12(고아 프로세스) → 종료 시 프로세스 트리 종료(`taskkill /T /F`)를 SessionManager 책임으로 명시.
4. 근본적으로 불가 → 외부 터미널(Windows Terminal)에 세션을 띄우고 앱은 옆 채널만 쓰는 방식. 임베드 경험을 잃으므로 이 경우 설계 재검토 회의를 연다.

---

## S2. 훅 → Node 스크립트 → 앱 IPC

**가정:** Claude Code 훅으로 턴 종료(Stop), 입력 대기(Notification), 세션 시작(SessionStart)을 1초 이내에 앱이 받고, Stop 훅으로 형식 오류를 에이전트에게 되돌릴 수 있다. (D2, D21, 8절)

**준비:** named pipe 서버를 여는 최소 앱(또는 S1 앱에 추가), `relay-hook.js`(의존성 없음, stdin JSON 읽기 → 파이프로 전송 → 응답 대기 → stdout), 샘플 레포 worktree.

**절차**

| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 훅 설정 주입 방식 A | `claude --settings <task 전용 settings 파일>`로 훅을 넣었을 때 동작 여부 |
| 2 | 훅 설정 주입 방식 B | worktree의 `.claude/settings.local.json`에 넣었을 때 동작 여부. 프로젝트 자체 `.claude/settings.json` 훅과 함께 실행되는지 |
| 3 | 훅 실행 런타임 | 사용자 PC에 Node가 없는 경우: 훅 명령을 `ELECTRON_RUN_AS_NODE=1 "<relay.exe>" "<relay-hook.js>"`로 실행 가능한지 (Windows에서 훅 명령이 어느 셸로 실행되는지 함께 확인) |
| 4 | 신호 지연 | 턴 종료 → 앱 수신 시각 차이 50회 측정 (p50, p95) |
| 5 | 입력 필드 | stdin의 `session_id`, `transcript_path`, `stop_hook_active`, Notification `message` 확인 |
| 6 | Notification 발생 조건 | 권한 프롬프트, 일정 시간 입력 없음 각각에서 오는지 |
| 7 | SessionStart | 새 세션과 `--resume` 각각의 `source` 값 |
| 8 | **Stop 차단(D21)** | Stop 훅이 `{"decision":"block","reason":"..."}`를 출력하면 에이전트가 이유를 받아 작업을 이어 가는지. `stop_hook_active`로 무한 반복이 막히는지 |
| 9 | 앱이 꺼져 있을 때 | 파이프 연결 실패 시 훅이 `ipc_timeout_ms` 안에 조용히 끝나고 CLI를 막지 않는지 |
| 10 | 위조 방지 | 토큰이 틀린 요청을 앱이 무시하는지 |
| 11 | 동시 세션 | 세션 3개에서 온 신호가 `RELAY_STEP_ID`로 올바르게 구분되는지 |

**판정 기준**
- 통과: 1 또는 2 중 하나가 동작, 3 동작, 4의 p95 < 1초, 8 동작, 9에서 CLI 지연 < 훅 타임아웃.
- 조건부 통과: 8이 안 됨 → D21을 버리고 형식 오류는 패널 표시만(8절 대안). 나머지 통과.
- 실패: Stop 신호를 안정적으로 받을 수 없음.

**실패 시 대안**
- 1이 안 되면 2(settings.local.json)를 쓴다. 둘 다 안 되면 사용자 설정(`~/.claude/settings.json`)에 relay 훅을 넣고 `RELAY_STEP_ID` 환경 변수가 없으면 즉시 종료하게 한다(다른 세션 영향 최소화).
- 3이 안 되면 훅용 단일 실행 파일(`relay-hook.exe`, Node SEA 등)을 배포한다.
- 4가 느리면 훅이 `<RELAY_HOME>/run/signals/`에 파일을 떨구고 앱이 감시하는 방식.
- Stop 신호 자체가 불안정하면: 자동 승인을 PTY 종료 기준으로만 허용(사람이 /exit 해야 자동 승인 시작). 사용성은 떨어지지만 D7은 유지된다.

---

## S3. 레포 밖 산출물 쓰기

**가정:** worktree에서 실행한 에이전트가 승인 프롬프트 없이 `RELAY_TASK_DIR`(중앙 저장소)에 파일을 쓰고, 다른 task 디렉터리는 읽을 수 있다. (D10, 5.3절)

**준비:** S2의 worktree, `<RELAY_HOME>/projects/<id>/works/<wid>/tasks/03-x/`.

**절차**

| # | 항목 |
|---|---|
| 1 | `--add-dir <work dir>`만 준 상태에서 쓰기 시 권한 프롬프트가 뜨는지 |
| 2 | 권한 허용 규칙(`Write`, `Edit` + work 디렉터리 경로)을 task 전용 settings에 넣었을 때 프롬프트 없이 써지는지. **Windows 절대 경로 표기**(드라이브 문자, 구분자)가 규칙에서 어떻게 해석되는지 |
| 3 | 규칙 범위: 다른 Work 디렉터리 쓰기는 여전히 프롬프트가 뜨는지 |
| 4 | 긴 경로: `C:\Users\<긴 이름>\.relay\projects\<id>\works\<wid>\tasks\12-final-verify\verification.md` 길이에서 문제가 없는지 |
| 5 | 한글이 들어간 사용자 이름 경로 |

**판정 기준:** 1 또는 2로 프롬프트 없이 쓰기 성공, 3에서 범위 밖은 막힘.

**실패 시 대안 (우선순위 순)**
1. worktree 안 `.relay/`(exclude 처리)를 **디렉터리 정션**(Windows, 관리자 권한 불필요) 또는 심볼릭 링크로 중앙 저장소 work 디렉터리에 연결.
2. worktree 안 `.relay/`에 쓰게 하고, 승인 시 앱이 중앙 저장소로 복사. 이 경우 worktree 삭제 전에 반드시 복사가 끝났는지 [Work 정리]가 확인한다.

---

## S4. 첫 프롬프트로 스킬 호출과 컨텍스트 전달

**가정:** 세션 시작 인자만으로(실행 중 주입 없이) 스킬을 확실히 트리거하고, 조립한 컨텍스트를 에이전트가 읽고 따른다. (D3, D18, 6.5절)

**준비:** `relay-root-cause` 스킬(명세 초안을 옮긴 SKILL.md), 샘플 버그의 evidence 산출물, 앱 없이 손으로 만든 `context.md`(약 6천 토큰).

**절차 — 세 방식을 각 10회 실행**

| 방식 | 명령 |
|---|---|
| A | `claude --session-id <uuid> "/relay-root-cause 이 task의 컨텍스트: <context.md 절대 경로>"` |
| B | `claude --session-id <uuid> "relay-root-cause 스킬로 작업하세요. 먼저 <context.md>를 읽으세요."` |
| C | A + `--append-system-prompt "<context.md 요약 5줄>"` (인터랙티브 모드에서 지원되는지 먼저 확인) |

측정 항목:

| # | 항목 | 기준 |
|---|---|---|
| 1 | 스킬 트리거 | SKILL.md 절차대로 움직였는가 |
| 2 | 컨텍스트 읽기 | 첫 행동이 context.md 읽기인가 |
| 3 | 컨텍스트 인지 | 첫 응답에 intent의 완료조건, 기각된 가설, 고정된 재현 테스트를 반영했는가(사람이 채점) |
| 4 | 인자 전달 | 공백, 한글, 따옴표가 든 경로가 Windows에서 깨지지 않는가 |
| 5 | 세션 ID | `--session-id`로 준 UUID로 기록이 남고 `--resume <uuid>`로 이어지는가 |
| 6 | 재개 + 프롬프트 | `claude --resume <uuid> "/relay-close"`가 마무리 스킬을 트리거하는가 (8.3 복구 흐름) |
| 7 | 이전 기록 접근 | 다른 세션의 transcript 경로를 path 조각으로 주면 필요할 때 검색하는가 |

**판정 기준:** 한 방식 이상이 1·2에서 10/10, 3에서 8/10 이상, 4·5·6 동작.

**실패 시 대안**
- 슬래시 트리거가 불안정하면 B(자연어 지시)로, B도 불안정하면 스킬 본문을 context.md 맨 앞에 넣는다(스킬 = 프롬프트 템플릿). 이 경우 스킬 배포(`.claude/skills` 복사)는 필요 없어진다.
- 6이 안 되면 `handoff_missing` 복구는 [새 세션으로 마무리]만 제공한다(새 세션에 이전 transcript 경로와 산출물을 주입).

---

## S5. (선택) Codex CLI 동일 항목

**목적:** Codex를 v1에 넣을지 결정한다(D9). 결론이 "v2"여도 설계가 벤더 중립인지 확인하는 의미가 있다.

**확인 항목:** S1(TUI 임베드), S2에 해당하는 턴 종료 신호(훅이나 알림 설정 등 Codex가 제공하는 방식), S3에 해당하는 레포 밖 쓰기(샌드박스의 쓰기 허용 경로), S4에 해당하는 스킬/프롬프트 템플릿 트리거와 세션 ID 지정·재개. 각 항목은 Codex 최신 문서로 방법을 먼저 조사한 뒤 같은 절차로 실측한다.

**판정 기준:** 턴 종료 신호, 레포 밖 쓰기, 시작 인자로 프롬프트 전달, 세션 재개가 모두 **PTY 주입 없이** 가능하면 "v1 후보", 하나라도 없으면 "v2 이후". v1 후보여도 M2 이후에 붙인다.

**산출:** 벤더 어댑터 인터페이스(architecture.md 3절 `VendorAdapter`)에 Codex를 넣었을 때 빠지는 기능 목록.

---

## S6. 컨텍스트 토큰 예산 실측

v0.1 절차를 유지한다. S4 이후에 한다.

1. 실제 버그 2~3건으로 버그 수정 파이프라인을 수동으로 끝까지 진행한다(앱 없이 스킬과 손으로 만든 context.md로).
2. task마다 조각별 inline 크기를 기록한다.
3. 같은 task를 예산 4k / 8k / 16k로 시작해 비교한다: 산출물을 다시 읽는 도구 호출 수, 이전 결정을 다시 묻는 빈도, 첫 응답 방향 정확도.
4. 품질 차이가 없는 가장 작은 값을 `context.token_budget` 기본값으로 정한다.
5. 부산물: `chars_per_token` 계수(한국어 비율별)와 handoff 본문 1,500자 기준이 적절한지.
