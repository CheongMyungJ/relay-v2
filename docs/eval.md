# relay 대 맨 CLI 사용성 평가

- 상태: 도구 준비 (평가 결과는 아직 없음)
- 코드: `app/eval/`
- 새 세션에서 돌리기: `.claude/skills/relay-eval/SKILL.md` (예: "시나리오 3번으로 5번 돌려서 평가해줘")

## 1. 목적

버그 수정에서 relay가 Claude Code CLI를 그냥 쓰는 것보다 얼마나 쓰기 좋은지 본다. 여러 상황(시나리오)을 두 쪽으로 똑같이 돌리고, 사람의 판단은 AI가 대신한다. 결과는 경향을 보는 자료다. 사람 역할과 판정이 AI이므로 실제 사용자 시험을 대신하지 않는다.

## 2. 구성

```
시나리오(버그 레포 + 숨긴 시험 + 사람이 아는 것)
  ├─ relay 쪽: 빌드한 Electron 앱(out/)을 가상 화면에 띄우고 Playwright로 누른다
  └─ 맨 CLI 쪽: 레포 폴더의 bash(PTY)에서 claude를 띄워 둔다
사람 역할(claude -p 세션 하나) ── 화면을 보고 행동을 JSON으로 고른다
판정: 숨긴 시험, 바뀐 파일, 설문, 짝 판정(claude -p)
보고서: report.md, report.json
```

| 파일 | 하는 일 |
|---|---|
| `eval/setup.sh` | 의존성(Electron 실행 파일 포함), 빌드, 가상 화면, 깨끗한 환경의 claude 호출 점검 |
| `eval/run.mjs` | 시나리오 × 쪽 × 회차를 돌리고 판정과 보고서까지 만든다 |
| `eval/report.mjs` | 결과 폴더에서 보고서를 다시 만든다. `--rejudge`는 짝 판정을 다시 한다 |
| `eval/check-scenario.mjs` | 시나리오가 제대로 짜였는지 확인한다(기준 레포, 정답 패치, 함정 패치) |
| `eval/lib/episode.mjs` | 실행 하나: 레포 준비, 사람 깨우기, 사건, 판정 |
| `eval/lib/relay-arm.mjs` | 앱 띄우기와 프로젝트 등록, 화면 읽기(스크린샷, 보이는 글자, 누를 수 있는 요소), 행동, 비정상 종료 |
| `eval/lib/cli-arm.mjs` | bash와 claude를 PTY로 띄우기, 터미널 화면(xterm headless), 입력, 새 터미널, 비정상 종료 |
| `eval/lib/human.mjs` | 사람 역할의 시스템 프롬프트, 차례마다 보일 화면, 행동 형식, 설문 |
| `eval/lib/judge.mjs` | 결과 판정(가림)과 경험 판정 |
| `eval/lib/dialogs.mjs` | Claude Code 첫 실행 창(폴더 신뢰, 권한 우회 경고) 수락. 두 쪽 같고 사람의 부담에 넣지 않는다 |
| `eval/guides/*.md` | 사람 역할이 미리 읽어 둔 도구 설명서 |
| `eval/scenarios/<id>/` | 시나리오 |

## 3. 공정하게 두는 것

- **같은 에이전트:** 두 쪽 모두 같은 claude 실행 파일(맨 CLI는 경로로 직접 띄우고, 셸의 `claude`도 PATH 맨 앞의 링크로 같은 파일을 가리킨다), 모델(`ANTHROPIC_MODEL`), effort(`CLAUDE_CODE_EFFORT_LEVEL`)다. 맨 CLI는 relay와 같게 `--dangerously-skip-permissions`로 띄운다(D17). `--cli-permission default`로 권한 확인을 켤 수 있다.
- **같은 환경:** 세션의 환경 변수를 넘기지 않고 고른 것만 넘긴다(`env -i`와 같음, 8.4). 에이전트, 사람 역할, 판정은 설정 폴더(`CLAUDE_CONFIG_DIR`)를 따로 써서 사용량을 나눠 센다. 두 쪽 모두 자동 업데이트 알림과 입력창의 흐린 추천 문구(prompt suggestion)를 끈다. 추천 문구는 화면 글자만 보는 사람 역할이 자기가 친 것으로 착각했다.
- **같은 사람:** 두 쪽의 사람 역할은 같은 모델, 같은 규칙, 같은 시나리오 정보를 받는다. 다른 것은 도구 설명서와 행동 목록뿐이다. 둘 다 "끝의 기준"(버그가 고쳐졌다고 납득하고 로컬 브랜치에 커밋됨)이 같다.
- **같은 깨우기:** 사람은 화면이 바뀌었다가 6초 동안 그대로면 깨어난다(화면이 멈춘 것을 알아챔). 스스로 기다리기로 한 시간이 지나도 깨어나고, 화면이 계속 바뀌어도 4분마다 한 번 들여다본다. relay의 OS 알림은 알림으로 보이고 사람을 깨운다(relay만 가진 기능이므로 그대로 둔다).
- **같은 시작점:** relay는 프로젝트가 등록된 앱에서, 맨 CLI는 레포 폴더에서 claude가 떠 있는 상태에서 시작한다. 등록과 첫 실행 창은 도구가 한다.
- **보는 것:** relay의 사람 역할은 스크린샷(요소 번호를 얹은 것), 보이는 글자, 누를 수 있는 요소 목록을 본다. 맨 CLI의 사람 역할은 터미널 화면 글자를 본다(터미널은 글자가 곧 화면이다). 둘 다 지금 보이는 만큼만 본다.
- **코드 보기:** 두 쪽 모두 `inspect_diff`로 바뀐 코드를 볼 수 있다(에디터로 훑어보는 것). 사람의 부담으로 센다.

## 4. 사람 역할

- `claude -p` 세션 하나가 한 실행 내내 같은 사람이다(`--session-id`로 시작, `--resume`으로 잇는다). 시스템 프롬프트를 바꿔 개발자 역할만 한다. 도구는 쓰지 않는다. relay의 스크린샷은 메시지에 그림으로 붙인다(도구로 읽게 하면 자주 건너뛴다).
- 차례마다 `thought`, `friction`(0 매끄러움 ~ 3 막힘)과 까닭, 행동 1~5개를 JSON(`--json-schema`)으로 답한다.
- 행동: relay는 `click`, `fill`, `select`, `scroll`, 맨 CLI는 `new_terminal`, `switch`, 공통으로 `type`(터미널 입력), `key`, `inspect_diff`, `wait`, `done`, `give_up`.
- 시나리오의 사실은 "처음부터 앎"과 "물으면 답함"으로 나뉜다. 물으면 답함은 에이전트가 묻거나 꼭 필요할 때만 말한다.
- 끝나면 같은 세션에서 설문(1~7)에 답한다: 수고, 명확함, 통제감, 결과 확신, 신뢰, 복구, 다시 쓰고 싶음, 좋았던 점, 불편했던 점.

## 5. 시나리오

`eval/scenarios/<id>/`에 `scenario.json`, `repo/`(기준 레포), `hidden/`(숨긴 시험)을 둔다.

| id | 상황 | 보는 것 |
|---|---|---|
| 01-slug | 재현과 위치가 분명한 한 줄 버그 | 단순한 버그에서 relay 절차가 부담인지 |
| 02-leaderboard | 재현도 위치도 모르는 모호한 리포트 | 조사와 질문, 숨은 두 번째 문제(동점자)를 찾는지 |
| 03-cart | 사람의 짐작(할인 계산)이 틀림 | 멀쩡한 코드를 고치지 않고 진짜 원인(가격 파싱)을 찾는지, 사람이 확인할 수 있는지 |
| 04-legacy-date | 리팩터링을 부르는 오래된 코드, 사람은 최소 수정을 원함 | 범위를 지키는지, 범위를 통제하기 쉬운지 |
| 05-csv | 수정이 시작된 뒤 요구가 늘어남 | 방향을 바꾸기 쉬운지, 두 요구를 다 채우는지 |
| 06-paginate-crash | 코드를 고치기 시작하고 15초 뒤 앱이나 터미널이 비정상 종료 | 상황 파악과 이어 가기의 부담, 결과가 온전한지 |
| 07-two-bugs | 관계없는 버그 둘, 사람은 따로 진행하길 원함 | 둘 다 끝내는지, 변경이 섞이지 않게 나누기 쉬운지 |
| 08-timezone | 내 환경에서 재현 안 됨(사용자 시간대) | 필요한 정보를 묻는지, 시간대마다 맞게 고치는지 |

`scenario.json`의 필드:

| 필드 | 뜻 |
|---|---|
| `id`, `title`, `purpose` | 이름과 평가 목적 |
| `repoName` | 레포 폴더 이름 (relay 프로젝트 이름이 된다) |
| `report` | 사람이 받은 리포트나 본 것 (문자열 또는 문자열 배열) |
| `knowledge` | `{ share: "upfront" \| "on_ask", text }` |
| `preferences` | 사람의 선호 |
| `reveals` | `{ when, afterSeconds, text }`: 때가 되면 사람에게 새로 떠오른 요구로 알린다 |
| `events` | `{ when, afterSeconds, do: "crash" }`: relay는 앱을 SIGKILL하고 다시 띄운다. 맨 CLI는 셸과 claude를 프로세스 그룹째 끝내고 같은 폴더에서 새 셸을 연다 |
| `when` | `first_change`(작업 폴더에 처음 커밋이나 변경이 생긴 때) 또는 `elapsed`(시작부터) |
| `expectedFiles` | 바뀌어도 되는 파일(glob). 나머지는 "기대 밖 파일"로 센다 |
| `checks` | `{ name, file, env?, bug?, guard? }`: `hidden/<file>`을 `node --test`로 돌린다. `env`로 TZ 같은 환경을 준다. `guard`는 기준에서도 통과하는 지키기 시험이다(멀쩡한 동작을 깨지 않았는지) |
| `limits` | `{ minutes, turns }` |

시나리오를 더할 때: `repo/`의 `npm test`는 기준 상태에서 통과해야 한다(리포트의 버그를 잡지 않는 시험). 숨긴 시험은 `../src/...`로 불러온다(레포의 `eval-hidden/`에 복사해 돌린다). `guard`가 아닌 숨긴 시험은 기준 상태에서 실패해야 한다.

시나리오 폴더에 `reference.patch`(정답 수정)와 `traps/*.patch`(그럴듯한 틀린 수정)를 둘 수 있다. `repo/`를 뿌리로 한 git diff이고, 평가 도구는 `repo/`만 복사하므로 에이전트에게 보이지 않는다. `node eval/check-scenario.mjs <id>`가 세 가지를 확인한다: 기준에서 `npm test`와 guard는 통과하고 나머지 숨긴 시험은 실패, 정답 패치에서 모두 통과, 함정 패치마다 숨긴 시험 하나 이상 실패. 09~14의 설계는 `docs/eval-hard-scenarios.md`에 있다.

## 6. 판정과 지표

- **결과(자동):** 숨긴 시험, 레포 시험, 바뀐 파일과 줄 수, 기대 밖 파일, 커밋 여부. relay는 Work마다 worktree가 있으므로 결과 폴더가 여럿일 수 있다. 맨 CLI도 에이전트가 버그마다 브랜치를 나누면 고친 것이 흩어지므로, 평가 레포(체크아웃된 브랜치)에 더해 체크아웃되지 않은 로컬 브랜치 가운데 기준 뒤에 커밋이 있고 HEAD에 아직 들어 있지 않은 것을 `git archive`로 꺼내 결과 폴더로 삼는다. 고친 것을 보는 시험은 한 곳에서라도 통과하면 통과이고, `guard` 시험은 바뀐 결과 폴더 모두에서 통과해야 통과다(바뀐 폴더가 없으면 모든 폴더). worktree가 [Work 정리]로 지워져도 판정할 수 있게 사람의 차례마다 복사해 둔다.
- **사람의 부담(자동):** 차례 수, 행동 수, 입력 글자 수, 코드 보기, 헛동작(쪽이 실패로 돌려준 행동: 없는 요소, 열린 터미널 없음 등), friction, 걸린 시간.
- **에이전트(자동):** 설정 폴더의 대화 기록에서 토큰(같은 메시지 id는 한 번), 세션 수.
- **설문:** 4절.
- **짝 판정:** 같은 시나리오 같은 회차의 relay와 맨 CLI를 A, B로 무작위로 놓고 판정 모델이 비교한다.
  - 결과 판정(가림): 코드 차이와 시험 결과만 본다. 커밋 메시지는 보이지 않는다. correctness, scope, quality, tests (1~5), 선호.
  - 경험 판정: 차례 기록과 설문을 본다. 기록에 도구가 드러나므로 가릴 수 없다. burden, clarity, control, recovery, confidence, overall의 우세와 점수(1~10).

## 7. 돌리기

```bash
bash app/eval/setup.sh                                  # 새 세션마다 한 번
cd app
node eval/run.mjs --list
node eval/run.mjs --scenarios 3 --runs 5 --parallel 2   # 시나리오 3을 두 쪽 5번씩
node eval/run.mjs --scenarios 1,5,6 --runs 2 --effort medium
node eval/report.mjs eval/results/<폴더>                # 보고서 다시 만들기
```

- 기본값: 에이전트 `sonnet`·effort `medium`, 사람 역할 `sonnet`·effort `medium`, 판정 `sonnet`.
- 결과: `app/eval/results/<시각>/`(git에 넣지 않음). `report.md`, `report.json`, `config.json`, `<시나리오>/<쪽>-<회차>/`에 `run.json`, `turns.jsonl`(차례 기록), `shots/`(relay 스크린샷), `final/*.diff`, `works/`(relay 산출물과 `pty.log`), `<시나리오>/judge-<회차>.json`.
- 작업 폴더: `/tmp/relay-eval/<결과 폴더 이름>/`(레포, relay 저장소, 설정 폴더). 컨테이너가 끝나면 없어진다. 같은 `--out`으로 다시 돌리면 같은 회차의 작업 폴더와 결과 폴더를 비우고 새로 한다.
- 시간: 실행 하나에 3~20분쯤이다. `--parallel 2`까지 권한다(Electron과 claude 둘이 함께 돈다).

## 8. 한계

- 사람 역할과 판정이 모두 Claude다. 같은 계열 모델의 편향이 있을 수 있고, AI 사람은 실제 사람보다 설명서를 잘 따르고 덜 지친다.
- 화면은 Linux 가상 화면이다. 주 플랫폼인 Windows(D12)의 글꼴과 ConPTY 차이는 보지 못한다.
- PR 진행(M9~M11)은 시나리오에 없다. 이 세션에서는 GitHub GraphQL이 막혀 gh의 PR 명령이 돌지 않는다(`spikes.md` S7). 가짜 gh로 넣을 수는 있다.
- 회차가 적으면 편차가 크다. 시나리오마다 3회 이상을 권한다.

## 9. 도구 확인 기록

평가 결과가 아니라 도구가 끝까지 도는지 본 기록이다. 2026-09-30, 앱 커밋 473f585, Claude Code 2.1.285, Linux 가상 화면, 에이전트 sonnet·low, 사람 역할 sonnet·low.

| 시나리오 | 쪽 | 결과 |
|---|---|---|
| 01-slug | 맨 CLI | done, 숨긴 시험 통과, 커밋됨. 차례 2, 0.7분 |
| 01-slug | relay | done, 숨긴 시험 통과, Work 완료(의도 정리 → 수정 → 리뷰 → 최종 검증, 모두 사람 승인). 차례 10, 2.7분 |
| 06-paginate-crash | 둘 다 (`--parallel 2`) | 두 쪽 모두 비정상 종료 뒤 이어 가 done, 숨긴 시험 통과. 짝 판정과 보고서까지 만듦 |
| 05-csv | 맨 CLI | 새 요구 알림을 받아 에이전트에게 전하고 done, 숨긴 시험 둘 다 통과 |

- 첫 실행 창(폴더 신뢰, 권한 우회 경고)은 두 쪽 모두 도구가 수락했다.
- relay 앱 두 개를 동시에 띄울 수 있다(`--user-data-dir`을 실행마다 따로 준다).
- 사람 역할의 비용은 relay가 실행당 0.7~2.3달러(스크린샷을 붙임), 맨 CLI가 0.1~0.3달러였다. 에이전트 사용량은 따로다.

