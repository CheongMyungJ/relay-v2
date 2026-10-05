---
name: relay-eval
description: relay-v2의 버그 수정, 기능 추가, 리팩터링, 일반 사용성을 맨 Claude Code CLI와 비교 평가한다. 시나리오마다 두 쪽(relay 앱, 맨 CLI. 지식 관리 시나리오는 지식을 켠 relay와 끈 relay)을 실제 claude로 n번 돌리고 사람 역할과 판정은 AI가 한다. "시나리오 3번으로 5번 돌려서 평가해줘", "사용성 평가 돌려줘", "relay vs CLI 비교", "시나리오 목록" 같은 요청에 쓴다.
---

# relay 사용성 평가 돌리기

설계와 지표는 `docs/eval.md`, 코드는 `app/eval/`에 있다. 이 절차대로 하면 새 세션에서 바로 돌릴 수 있다.

## 1. 요청 읽기

- 시나리오: 번호(`3`, `1,5`), id(`03-cart`), "전부"(`all`). 목록은 `node app/eval/run.mjs --list`(유형을 `[버그 수정]`/`[기능 추가]`/`[리팩터링]`/`[일반]`으로 보인다). 01~14는 버그 수정, 15~17은 기능 추가(작은·중간·큰), 18~20은 리팩터링(작은·중간·큰), 21~24는 지식 관리(같은 레포에서 Work 둘을 잇는 버그 수정, 24는 Work 2를 팀원이 함), 25~27은 지식 관리 개발용("전부"에 들지 않고 번호로만 고름), 28~30은 일반(설정·CI, 의존성 올리기, 섞인 일)이다. 31(리팩터링)과 32(기능 추가)는 요청을 짧게 하고 세부 사항을 사람이 짚어 줘야 떠올리는(`recall`) 시나리오다. "기능 추가 시나리오"는 `15,16,17`, "리팩터링 시나리오"는 `18,19,20`, "지식 관리 시나리오"는 `21,22,23,24`, "일반 시나리오"는 `28,29,30`이다. 지식 실험(`docs/knowledge-experiment/protocol.md`)의 주지표는 `node app/eval/primary.mjs <결과 폴더> --pair relay:relay-off`로 본다.
- 횟수: "n번" → `--runs n` (시나리오와 쪽마다 n번). 말이 없으면 1.
- 쪽: 말이 없으면 시나리오의 짝으로 돈다. Work 여럿을 잇는 시나리오(21~27)는 relay 대 지식을 끈 relay(`relay-off`, 앱에 `RELAY_KNOWLEDGE=off`), 나머지(01~20, 28~30)는 relay 대 맨 CLI다. "relay만" → `--arms relay`, "CLI만" → `--arms cli`. 21~24를 맨 CLI와도 견주려면 `--arms relay,relay-off,cli`(판정은 짝만 한다. 다른 짝은 `--pairs relay:cli`). 다른 커밋의 빌드와 견주려면 `bash app/eval/ref-app.sh <이름> <커밋>` 뒤 `--app <이름>=/tmp/relay-ref/<이름>/app --arms relay,<이름> --pairs relay:<이름>`. "교차 비교"(같은 일을 전용 유형과 일반 유형으로, relay I93)는 `--scenarios 1,10,15,16,18,19 --arms relay,relay@general --pairs relay:relay@general`이다. `relay@<유형>` 쪽은 사람 역할이 그 유형으로 새 Work를 만든다.
- 모델과 effort: 말이 있을 때만 `--agent-model`, `--effort`, `--human-model`, `--judge-model`을 준다. 기본은 에이전트 sonnet·medium, 사람 역할 sonnet·medium, 판정 sonnet.
- 시나리오 번호가 목록에 없거나 요청이 모호할 때만 묻는다. 나머지는 기본값으로 바로 시작하고 무엇으로 돌리는지 한 줄로 알린다.

## 2. 준비 (새 세션마다 한 번, 2~3분)

```bash
bash app/eval/setup.sh
```

의존성(Electron 실행 파일 포함), 앱 빌드, 가상 화면(Xvfb), 깨끗한 환경의 `claude -p` 호출을 점검한다. 실패하면 출력의 이유대로 고친다. 네트워크나 프록시 문제면 `/root/.ccr/README.md`를 본다.

## 3. 돌리기

실행 하나에 3~20분쯤 걸린다. 21~24는 실행 하나가 Work 둘이라 그 두 배쯤이다. 전체 수(시나리오 × 쪽 × 회차)와 대략의 시간을 사용자에게 먼저 알린다. `--parallel 2`를 기본으로 쓴다(실행이 하나뿐이면 1).

백그라운드로 돌리고 진행을 지켜본다:

```bash
cd app && node eval/run.mjs --scenarios <목록> --runs <n> --parallel 2 > eval/results/run-$(date +%H%M%S).log 2>&1
```

- Bash의 `run_in_background`로 띄운다. `eval/results/`가 없으면 먼저 만든다.
- Monitor로 로그를 본다. 필터는 `차례|끝:|결과:|실패|오류|Error|사건|진행|판정|보고서`. 한 줄은 `[시나리오 쪽#회차] 차례 n (경과, 깨운 까닭) friction=… 행동`이다.
- 모든 실행이 끝나면 run.mjs가 짝 판정을 하고 `report.md`를 만든다. 마지막 줄에 보고서 경로가 찍힌다.
- 중간에 멈췄으면 끝난 실행만으로 `node eval/report.mjs <결과 폴더>`를 돌려 보고서를 만들 수 있다(판정까지 다시 하려면 `--rejudge`).

## 4. 결과 알리기

1. `report.md`를 읽는다. 시나리오별 표(숨긴 시험 통과율, 시간, 사람 차례와 행동, friction, 설문, 판정의 우세)를 본다. 기능 추가는 작은 기능(15)에서 설계와 계획 단계가 부담이었는지(relay D233)와 승인 수를 버그 수정(01)과 견준다. 리팩터링은 작은 것(18)의 부담을 15, 01과 견주고, 19에서 숨은 버그를 고쳤는지(D260), 20에서 동작 차이를 물었는지(D270)를 본다. 일반(28~30)은 intent 초안의 완료조건마다 확인 방법이 있었는지(D305), 28에서 Node 18을, 29에서 반올림 규정을, 30에서 쿠폰·할인 차례를 물었는지(D308), 29에서 verify가 `npm test`만으로 판정하지 않고 보완했는지(D312)를 본다. 교차 비교는 짝 `relay:relay@general`의 숨긴 시험, 승인 수, 사람 차례, 설문의 수고와 결과 확신을 유형별로 견준다. 지식 관리(21~23)는 시나리오마다 "Work 2 (재는 Work)" 표에서 relay와 relay-off의 사람 차례, 에이전트 질문 수(AskUserQuestion), 입력 토큰, `참고 지식` 글자, 숨긴 시험을 견준다. 지식을 켠 쪽의 Work 2 intake `context.md`에 Work 1의 규칙이 들어갔는지(`works/<Work>/tasks/01-intake/context.md`), 들어갔는데도 물었는지를 확인한다. Work 1에서 지식 후보가 없었으면(사람 역할이 규칙을 말하지 않았거나 에이전트가 적지 않음) 그 회차는 지식의 효과를 볼 수 없으니 따로 센다.
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

`docs/eval.md` 5절의 형식을 따른다(09~14의 설계는 `docs/archive/eval-hard-scenarios.md`). Work 둘을 잇는 시나리오는 `report`, `knowledge`, `checks` 대신 `works`에 Work마다 두고, Work마다의 정답을 `reference-<n>.patch`로 둔다(그 Work의 시험만 통과하고 다른 Work의 시험은 실패해야 한다). 기능 추가 시나리오는 `scenario.json`에 `"type": "feature"`를 두고, 인수 조건을 숨긴 시험으로 둔다. 리팩터링 시나리오는 `"type": "refactor"`를 두고, 동작 보존 시험은 guard(기준에서도 통과), 구조 조건 시험은 guard가 아닌 것(기준에서 실패)으로 둔다. 일반 시나리오는 `"type": "general"`을 두고, 사람만 아는 사실로 갈리는 함정을 하나씩 둔다(28~30). 정답 수정은 `reference.patch`, 그럴듯한 틀린 수정은 `traps/*.patch`로 두고 확인한다:

```bash
cd app && node eval/check-scenario.mjs <id>   # 기준: npm test와 guard 통과, 나머지 숨긴 시험 실패 / 정답 패치: 모두 통과 / 함정 패치: 하나 이상 실패
```

새 시나리오는 맨 CLI로 한 번 시범 실행해(`--arms cli --runs 1`) 너무 쉽지 않은지 본다.
