---
name: relay-eval
description: relay-v2의 버그 수정 사용성을 맨 Claude Code CLI와 비교 평가한다. 시나리오마다 두 쪽(relay 앱, 맨 CLI)을 실제 claude로 n번 돌리고 사람 역할과 판정은 AI가 한다. "시나리오 3번으로 5번 돌려서 평가해줘", "사용성 평가 돌려줘", "relay vs CLI 비교", "시나리오 목록" 같은 요청에 쓴다.
---

# relay 사용성 평가 돌리기

설계와 지표는 `docs/eval.md`, 코드는 `app/eval/`에 있다. 이 절차대로 하면 새 세션에서 바로 돌릴 수 있다.

## 1. 요청 읽기

- 시나리오: 번호(`3`, `1,5`), id(`03-cart`), "전부"(`all`). 목록은 `node app/eval/run.mjs --list`.
- 횟수: "n번" → `--runs n` (시나리오와 쪽마다 n번). 말이 없으면 1.
- 한쪽만: "relay만" → `--arms relay`, "CLI만" → `--arms cli`.
- 모델과 effort: 말이 있을 때만 `--agent-model`, `--effort`, `--human-model`, `--judge-model`을 준다. 기본은 에이전트 sonnet·medium, 사람 역할 sonnet·medium, 판정 sonnet.
- 시나리오 번호가 목록에 없거나 요청이 모호할 때만 묻는다. 나머지는 기본값으로 바로 시작하고 무엇으로 돌리는지 한 줄로 알린다.

## 2. 준비 (새 세션마다 한 번, 2~3분)

```bash
bash app/eval/setup.sh
```

의존성(Electron 실행 파일 포함), 앱 빌드, 가상 화면(Xvfb), 깨끗한 환경의 `claude -p` 호출을 점검한다. 실패하면 출력의 이유대로 고친다. 네트워크나 프록시 문제면 `/root/.ccr/README.md`를 본다.

## 3. 돌리기

실행 하나에 3~20분쯤 걸린다. 전체 수(시나리오 × 쪽 × 회차)와 대략의 시간을 사용자에게 먼저 알린다. `--parallel 2`를 기본으로 쓴다(실행이 하나뿐이면 1).

백그라운드로 돌리고 진행을 지켜본다:

```bash
cd app && node eval/run.mjs --scenarios <목록> --runs <n> --parallel 2 > eval/results/run-$(date +%H%M%S).log 2>&1
```

- Bash의 `run_in_background`로 띄운다. `eval/results/`가 없으면 먼저 만든다.
- Monitor로 로그를 본다. 필터는 `차례|끝:|결과:|실패|오류|Error|사건|진행|판정|보고서`. 한 줄은 `[시나리오 쪽#회차] 차례 n (경과, 깨운 까닭) friction=… 행동`이다.
- 모든 실행이 끝나면 run.mjs가 짝 판정을 하고 `report.md`를 만든다. 마지막 줄에 보고서 경로가 찍힌다.
- 중간에 멈췄으면 끝난 실행만으로 `node eval/report.mjs <결과 폴더>`를 돌려 보고서를 만들 수 있다(판정까지 다시 하려면 `--rejudge`).

## 4. 결과 알리기

1. `report.md`를 읽는다. 시나리오별 표(숨긴 시험 통과율, 시간, 사람 차례와 행동, friction, 설문, 판정의 우세)를 본다.
2. 숫자만 옮기지 말고 까닭을 확인한다. friction이 높은 차례, 끝이 `done`이 아닌 실행, 헛동작이 많은 실행은 그 실행의 `turns.jsonl`(사람 역할의 생각과 행동)과 relay라면 `shots/`의 스크린샷, `works/*/tasks/*/pty.log`를 열어 무슨 일이 있었는지 본다.
3. 도구 문제(`harness_error`, `human_error`, 첫 실행 창을 넘지 못함)는 평가 결과에서 빼고 따로 알린다. relay의 문제로 보이는 것과 평가 도구의 문제를 가른다.
4. 사용자에게: 무엇을 몇 번 돌렸는지, relay가 나았던 곳과 못했던 곳을 숫자와 함께, 눈에 띈 사례 한두 개, 한계(AI 사람 역할, 회차 수)를 짧게 알린다. 보고서는 Artifact로 게시하면 표를 보기 쉽다.
5. 결과 폴더는 git에 들어가지 않고 컨테이너와 함께 사라진다. 남기려면 사용자에게 물어 `app/eval/reports/<날짜>-<시나리오>.md`로 `report.md`를 복사해 커밋한다.

## 문제가 생기면

- `준비가 덜 됐습니다`: setup.sh를 다시 돌린다.
- Xvfb 오류: `DISPLAY`가 비어 있으면 run.mjs가 `:90`부터 띄운다. 남은 잠금 파일 `/tmp/.X9*-lock`을 지운다.
- 앞 실행이 남긴 프로세스: `pkill -f 'electron.*relay-eval'`, `pkill -f 'relay-eval.*claude'`.
- 사람 역할 호출이 세 번 잇달아 실패하면 그 실행은 `human_error`로 끝난다. 로그의 오류 문구를 본다.
- 디스크: 작업 폴더는 `/tmp/relay-eval/`이다. 다 쓴 폴더는 지워도 된다.

## 시나리오를 더하거나 고칠 때

`docs/eval.md` 5절의 형식을 따른다(09~14의 설계는 `docs/eval-hard-scenarios.md`). 정답 수정은 `reference.patch`, 그럴듯한 틀린 수정은 `traps/*.patch`로 두고 확인한다:

```bash
cd app && node eval/check-scenario.mjs <id>   # 기준: npm test와 guard 통과, 나머지 숨긴 시험 실패 / 정답 패치: 모두 통과 / 함정 패치: 하나 이상 실패
```

새 시나리오는 맨 CLI로 한 번 시범 실행해(`--arms cli --runs 1`) 너무 쉽지 않은지 본다.
