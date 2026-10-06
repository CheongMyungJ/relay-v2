# relay-v2 스파이크 코드

- 상태: 보관 (2026-10-05). 스파이크는 설계의 전제를 확인하는 탐색이고 시험이 아니다. 계속 확인할 것은 [계약](`app/test/contract`, `docs/implementation.md` 8.1)으로 옮겼다: S2의 훅 본문과 Stop 응답은 `live.test.ts`(실제 `claude`의 훅 본문, 정기 실행), S7의 gh·GitHub 모양은 `live-gh.test.ts`(시험용 레포의 PR을 앱의 어댑터로 읽음)가 본다. 새 전제를 확인할 때만 스파이크를 더하거나 다시 돌린다.

`docs/spikes.md`의 S1~S7을 자동으로 확인하는 코드다. S1~S6은 Claude Code를 node-pty(Windows는 ConPTY)로 띄우고, 화면은 xterm headless로 읽고, 상태는 로컬 HTTP 훅 서버로 받는다. S7은 Claude Code 없이 gh와 git으로 시험용 레포(`CheongMyungJ/relay-v2-test`)에 PR을 만들어 GitHub 동작을 본다.

## 파일

| 파일 | 내용 |
|---|---|
| `run.mjs` | 실행기. 결과를 `results/<id>.json`, `results/summary.md`에 쓴다 |
| `s1-terminal.mjs` | S1 터미널 임베드. 한글 IME 조합 입력은 자동화할 수 없어 실기에서 사람이 확인한다 |
| `s2-hooks.mjs` | S2 HTTP 훅, Stop 되돌림, 훅 서버가 꺼졌을 때 |
| `s3-skills.mjs` | S3 `--add-dir` 스킬, `disable-model-invocation`, `--resume`, `/compact` |
| `s4-permissions.mjs` | S4 deny 규칙이 막는 범위, 관리 설정으로 모드가 막혔을 때 |
| `s5-first-run.mjs` | S5 첫 실행 창. 깨끗한 사용자 프로필이 필요해 가장 먼저 돌린다 |
| `s6-resume.mjs` | S6 강제 종료 뒤 `--resume`. 강제 종료는 Windows는 `taskkill /T /F`, Linux는 프로세스 그룹에 SIGKILL이다 |
| `s7-github.mjs` | S7 GitHub 연동. 시험용 레포에 PR을 만들어 상태, 체크와 실패 로그, 코멘트의 작성자, 답글과 보이지 않는 표시, 체크 재실행, 충돌, 원격 PR 브랜치 맞추기, 머지, API 한도를 본다. 단계(start, finish, cleanup)로 나뉜다 |
| `lib/` | PTY 세션, 훅 서버, 테스트용 레포와 결과 기록 |

## 실행

GitHub Actions: Actions 탭 → `spikes` → Run workflow. 결과는 실행 요약(Job Summary)과 `spike-results` 결과물에 올라간다. 인자 없이 돌리면 S7을 뺀 전부를 돌린다(S7은 아래).

로컬(Windows):

```powershell
cd spikes
npm ci
$env:CLAUDE_CODE_OAUTH_TOKEN = "<claude setup-token으로 받은 토큰>"   # 또는 로그인된 상태로 실행
node run.mjs            # 전부
node run.mjs S2 S3      # 일부
```

- 환경 변수 `SPIKE_MODEL`로 모델을 바꾼다(기본 `sonnet`).
- `CLAUDE_BIN`으로 `claude` 실행 파일 경로를 직접 줄 수 있다.

Linux(예: Claude Code 웹 세션의 컨테이너)에서 예비 확인할 때는 세션의 환경 변수가 넘어가지 않게 `env -i`로 필요한 것만 넘긴다. 대화형 온보딩을 마친 적이 없는 환경이면 따로 만든 설정 폴더를 `CLAUDE_CONFIG_DIR`로 주고, 그 폴더로 `claude auth status`를 한 번 돌려 만든 `.claude.json`에 `"hasCompletedOnboarding": true`만 더한다. root에서는 `IS_SANDBOX=1`이 있어야 `--dangerously-skip-permissions`로 뜬다.

```bash
cd spikes && npm ci
env -i HOME="$HOME" PATH="$PATH" SHELL=/bin/bash TERM=xterm-256color LANG=C.UTF-8 \
  HTTPS_PROXY="$HTTPS_PROXY" NO_PROXY="$NO_PROXY" NODE_EXTRA_CA_CERTS="$NODE_EXTRA_CA_CERTS" SSL_CERT_FILE="$SSL_CERT_FILE" \
  IS_SANDBOX=1 CLAUDE_CONFIG_DIR=<설정 폴더> SPIKE_MODEL=sonnet CLAUDE_CODE_EFFORT_LEVEL=low \
  node run.mjs S6
```

### S7 (GitHub 연동)

S7은 Claude Code를 쓰지 않는다. gh, git, Node 22만 있으면 되고 `npm ci`는 필요 없다. Claude Code 웹 세션에서는 GitHub GraphQL이 막혀 gh의 PR 명령이 돌지 않으므로(`docs/spikes.md` S7) 러너나 사람의 PC에서 돌린다(`docs/implementation.md` I47).

GitHub Actions: Actions 탭 → `spikes` → Run workflow에서 `spikes`에 `S7`만 적고, `s7`에서 단계를 고르고, finish면 `s7_pr`에 PR 번호를 적는다. S7을 다른 스파이크와 함께 적으면 아무것도 돌리지 않고 멈춘다. Linux 러너에서 돌고, Claude 인증 대신 레포 secret `RELAY_TEST_GH_REPO`(owner/repo)와 `RELAY_TEST_GH_TOKEN`(시험용 레포 하나에만 권한이 있는 fine-grained 토큰. 권한은 시험용 레포의 README)을 쓴다(I43). 결과는 실행 요약과 `spike-s7-results` 결과물에 올라간다. 로그에는 secret인 레포 이름이 `***`로 가려진다.

로컬(gh와 git이 있는 PC):

```powershell
cd spikes
$env:RELAY_TEST_GH_REPO = "CheongMyungJ/relay-v2-test"
$env:GH_TOKEN = "<시험용 레포 토큰>"   # 없으면 gh auth login으로 로그인한 계정을 쓴다
$env:S7_PHASE = "start"               # start / finish / cleanup
$env:S7_PR = ""                       # finish일 때 PR 번호
node run.mjs S7
```

git push도 gh의 자격 증명(`gh auth git-credential`)으로 한다. 이 설정은 스크립트가 띄운 git에만 주고 전역 설정은 바꾸지 않는다.

**단계와 사람이 할 일**

1. **start**: main에서 임시 기준 브랜치 `s7/<run>/base`를 만들고 그 브랜치에 시험 PR을 연다. 레포의 main은 건드리지 않는다. 절차 1, 2, 3(소유자와 봇), 4, 5, 7, 8, 9를 한다. 끝나면 PR을 열어 둔 채 사람이 할 일을 실행 요약과 `results/S7-human.md`에 적는다. 도중에 실패하면 만든 브랜치와 PR을 치운다.
2. **사람** (start가 끝난 뒤): 토큰의 계정이 아닌 두 계정으로 그 PR에 코멘트를 단다.
   - 계정 A: 시험용 레포의 협업자(레포 Settings → Collaborators에서 초대하고, 계정 A가 초대를 수락함)
   - 계정 B: 협업자가 아닌 계정
   - 계정마다: 대화 코멘트 하나, `src/cart.mjs`의 더한 줄에 인라인 코멘트를 단 리뷰(Comment) 하나, 소유자가 단 인라인 코멘트 스레드에 답글 하나. 계정 A는 할 수 있으면 Approve 리뷰도 하나.
   - 아무 계정으로나 PR 화면에서 앱이 게시한 답글 둘("relay가 게시한 답글입니다")에 `<!-- relay:` 글자가 보이지 않는지 본다.
3. **finish** (`s7_pr`=PR 번호): 모든 코멘트의 작성자 관계를 읽고 REST의 협업자 여부와 맞춰 본다(절차 3). 머지 방식을 읽고, 옛 head로 머지하면 막히는지, 본 head로 머지되는지, 원격 브랜치를 지울 수 있는지 본다(절차 6). `--delete-branch`를 준 머지가 worktree를 어떻게 하는지 보려고 PR 둘을 더 만들어 머지한다. 마지막에 이 시험의 브랜치와 열린 PR을 모두 치운다.
4. **cleanup**: 남은 `s7/` 브랜치와 열린 시험 PR을 모두 치운다. `s7_pr`(로컬은 `S7_PR`)을 주면 그 PR의 시험만 치운다. 사람이 코멘트를 달지 않고 끝낼 때나 finish가 도중에 멈췄을 때 쓴다.

기다림이 길어져 한 단계가 75분을 넘으면 멈추고, start와 finish는 만든 브랜치와 PR을 치운다. 러너 작업의 제한(90분)은 이보다 길어서, 작업이 끊기기 전에 정리가 돈다.

결과 파일: `results/S7-<단계>.json`(판정과 관찰), `results/S7-<단계>-raw.json`(읽은 코멘트 원본), `results/S7-human.md`(start 뒤 사람이 할 일).

## 결과 읽는 법

- ✅ 통과, ❌ 실패, 👀 관찰(판정 없이 기록), 💥 실행기 오류
- 에이전트 행동이 들어간 항목(예: `AskUserQuestion` 사용)은 매번 같지 않을 수 있다. 실패하면 한 번 더 돌려 보고 판단한다.
- 러너는 Windows Server라 사용자 PC(Windows 10/11)와 다르다. 러너 결과는 예비 확인이고, 실기 확인은 `docs/spikes.md`의 규칙을 따른다.
