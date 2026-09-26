# relay-v2 스파이크 코드

`docs/spikes.md`의 S1~S5를 자동으로 확인하는 코드다. Claude Code를 node-pty(Windows는 ConPTY)로 띄우고, 화면은 xterm headless로 읽고, 상태는 로컬 HTTP 훅 서버로 받는다.

## 파일

| 파일 | 내용 |
|---|---|
| `run.mjs` | 실행기. 결과를 `results/<id>.json`, `results/summary.md`에 쓴다 |
| `s1-terminal.mjs` | S1 터미널 임베드. 한글 IME 조합 입력은 자동화할 수 없어 실기에서 사람이 확인한다 |
| `s2-hooks.mjs` | S2 HTTP 훅, Stop 되돌림, 훅 서버가 꺼졌을 때 |
| `s3-skills.mjs` | S3 `--add-dir` 스킬, `disable-model-invocation`, `--resume`, `/compact` |
| `s4-permissions.mjs` | S4 deny 규칙이 막는 범위, 관리 설정으로 모드가 막혔을 때 |
| `s5-first-run.mjs` | S5 첫 실행 창. 깨끗한 사용자 프로필이 필요해 가장 먼저 돌린다 |
| `lib/` | PTY 세션, 훅 서버, 테스트용 레포와 결과 기록 |

## 실행

GitHub Actions: Actions 탭 → `spikes` → Run workflow. 결과는 실행 요약(Job Summary)과 `spike-results` 결과물에 올라간다.

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

## 결과 읽는 법

- ✅ 통과, ❌ 실패, 👀 관찰(판정 없이 기록), 💥 실행기 오류
- 에이전트 행동이 들어간 항목(예: `AskUserQuestion` 사용)은 매번 같지 않을 수 있다. 실패하면 한 번 더 돌려 보고 판단한다.
- 러너는 Windows Server라 사용자 PC(Windows 10/11)와 다르다. 러너 결과는 예비 확인이고, 실기 확인은 `docs/spikes.md`의 규칙을 따른다.
