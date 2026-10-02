# 지식 관리 자율 실험: 규약

- 상태: 고정 (2026-10-02). 실험 중에 바꾸지 않는다. 바꿀 일이 생기면 사람에게 묻고, 바꾼 까닭을 `log.md`에 적는다.
- 브랜치: `exp/knowledge-auto` (출발점 `0247049`, 지식 관리가 없던 마지막 커밋)
- 함께 보는 문서: `log.md`(실험 기록, 실험하는 세션이 채움), `kickoff.md`(실험을 시작한 지시문)

## 1. 목적

relay-v2에 지식 관리를 넣는다. 목표는 하나다: **relay로 일하는 동안 지식을 뽑고, 다음 일에 쓰고, 팀이 함께 쓸 수 있는 형태로 남긴다.** 무엇을 지식으로 볼지, 언제 어떻게 뽑고 거를지, 어디에 어떤 형식으로 둘지, 다음 일에 언제 어떻게 넣을지는 실험하는 세션이 정한다. 정할 때는 평가로 확인하고 근거를 남긴다.

이 실험은 같은 목표를 사람과 문답으로 결정을 미리 정해 만든 구현(main의 M17, 커밋 `9c7208d`~`aa39d16`)과 견준다. 그래서 그 구현을 보지 않고 만든다(2.3).

## 2. 고정한 것

### 2.1 팀 공유의 최소 원칙 (사람이 정함)

1. 팀이 함께 쓰는 지식은 레포에 커밋해 git과 PR로 공유한다. 앱 저장소(`RELAY_HOME`)에만 있는 지식은 팀 지식이 아니다.
2. 레포에 남는 지식은 사람이 GitHub에서 그대로 읽을 수 있는 글이다.
3. 비밀(토큰, 비밀번호, 내부 주소)과 개인정보는 지식에 넣지 않는다.

이 밖의 것(위치, 형식, `CLAUDE.md`나 `AGENTS.md`를 쓸지, 거르는 방식, 사람이 개입하는 정도, 나만 쓰는 지식을 둘지 등)은 실험하는 세션이 정한다. 평가로 잴 수 없는 결정은 판단과 까닭을 `log.md`에 적는다.

### 2.2 끄는 스위치

앱은 환경 변수 `RELAY_KNOWLEDGE=off`를 받으면 지식 관리를 모두 끈다. 지식을 모으지도, 넣지도, 커밋하지도 않고, 지식 관련 화면과 사람의 수고도 없다. 평가의 `relay-off` 쪽이 이것이고, 개발 중의 대조군이다. 마지막 비교의 대조군은 지식 관리가 없는 빌드 그대로(`base`, `0247049`)다(6절).

### 2.3 보지 않는 것

실험하는 세션은 다음을 읽지 않는다: main 브랜치의 `9c7208d`, `eb41e18`, `aa39d16` 커밋과 그 뒤의 지식 관리 코드·설계(`docs/design.md`의 3.6, 5.7, 부록 B, `app/src/*/knowledge*`, `skills/`의 지식 관련 줄), 평가 보고서 `app/eval/reports/2026-10-02-21-23.md`, `docs/eval-findings.md`의 D324~D326, GitHub PR #25~#27, 브랜치 `audit/knowledge-scenarios-20261002`. 평가 도구와 시나리오 21~23은 그 커밋들에서 가져왔지만 이 브랜치에 있는 것만 본다. 실수로 봤으면 무엇을 봤는지 `log.md`에 적는다.

### 2.4 봉인한 hold-out

`app/eval/sealed/holdout.tar.gz.enc`에는 마지막 비교에만 쓰는 시나리오 둘과 견줄 빌드의 화면 설명서가 암호화돼 있다. 열쇠는 사람만 갖고, 개발이 끝난 뒤 마지막 비교를 시킬 때 준다. 열쇠를 찾거나 풀려고 하지 않는다. hold-out의 내용은 개발용 시나리오(3.1)와 다르다. 개발용 시나리오에 맞춘 꼼수는 hold-out에서 드러난다.

## 3. 평가 자료

### 3.1 개발용 시나리오 (보임)

| 시나리오 | Work | 무엇을 보나 |
|---|---|---|
| 21-invoice-credit | 같은 사람 2 | 사람이 Work 1에서 알려 준 회계 규칙을 Work 2에서 다시 말하게 하는지 |
| 22-flaky-retry | 같은 사람 2 | 처음에 들은 팀 규칙(재시도로 덮지 않기)을 Work 2에서 지키는지, 다시 묻는지 |
| 23-double-notify-digest | 같은 사람 2 | Work 1에서 겪은 실패 유형이 Work 2의 두 원인을 찾는 데 이어지는지 |
| 24-invoice-credit-teammate | 사람 A 1, 팀원 B 1 | 21과 같은 일을 Work 2에서 팀원이 한다. 팀원은 규칙을 모른다. 레포로 건너간 지식만 닿는다 |

실험하는 세션은 개발용 시나리오를 더 만들어도 된다(`docs/eval.md` 5절 형식). 더한 시나리오는 개발에만 쓰고 판정 규칙(5절)에는 쓰지 않는다.

### 3.2 평가 도구에 더한 것

- **팀원 교대** (`works`의 `"teammate": true`): 그 Work 전에 도구가 앞 사람 레포의 브랜치(main에 없는 커밋이 있는 것)를 오래된 차례로 main에 머지하고(PR 머지 흉내), 팀 원격에 올리고, 새로 clone한다. relay는 새 앱 저장소와 새 Electron 사용자 폴더로 그 clone을 등록하고, 맨 CLI는 그 폴더에서 claude를 새로 띄운다. 커밋하지 않은 것과 앱 저장소에만 있는 것은 건너가지 않는다. 사람 역할은 [완료만]으로 Work를 끝내므로, **팀 지식은 Work를 끝낼 때 Work 브랜치의 커밋으로 남아 있어야 평가에서 건너간다.** 머지 충돌은 뒤 브랜치 쪽으로 머지하고 `run.json`의 `handoffs`에 적는다.
- **다시 알려 줌** (`knowledge`의 `"carry": true`, 사람 역할의 `told`): 사람 역할은 차례마다 "네가 아는 것"의 몇 번 항목을 새로 알려 줬는지 적는다. 에이전트가 먼저 꺼낸 것을 "맞다"고 확인만 한 것은 세지 않는다. carry 항목은 앞 Work에서 이미 알려 줬던 사실이다. Work마다 `carriedTold`(다시 알려 준 carry 항목 수)를 `workResults[].human`에 둔다.
- **재는 Work** (시나리오의 `measure`): 없으면 첫 Work를 뺀 모두다.
- **다른 빌드를 쪽으로** (`run.mjs --app 이름=폴더`, `--pairs`): 6절.
- **넣은 지식의 글자** (참고 지표): 앱이 task 폴더(`<RELAY_HOME>/projects/*/works/*/tasks/<seq>-<node>/`)에 `knowledge-injected.md`로 그 task에 넣은 지식을 남기면 보고서가 글자 수를 센다. 남기지 않아도 된다.

## 4. 지표 (고정)

`app/eval/primary.mjs`가 계산한다. 실행 하나마다 재는 Work를 모아 값을 하나 내고, 쪽마다 시나리오별 평균을 본다. 두 쪽의 차이는 시나리오마다 두 쪽의 평균 차를 시나리오 수로 평균한 것이고, 구간은 시나리오 안에서 쪽마다 실행을 복원 추출한 bootstrap 95%(10,000번, 씨앗 고정)다.

| 지표 | 정의 | 좋은 쪽 |
|---|---|---|
| **PM1 다시 알려 줌** | 재는 Work의 `carriedTold` 합. carry 항목이 있는 시나리오만 | 낮음 |
| **PM2 숨긴 시험** | 재는 Work가 모두 숨긴 시험을 통과한 실행의 비율 | 높음 |
| 입력 글자 | 재는 Work의 사람 입력 글자 합 | 낮음 |
| 질문 수 | 재는 Work의 에이전트 AskUserQuestion 수 합 | 낮음 |
| 사람 차례 | 재는 Work의 사람 차례 합 | 낮음 |
| 입력 토큰 | 재는 Work의 에이전트 입력 토큰(캐시 포함) 합 | 낮음 |
| 에이전트 시간 | 재는 Work의 걸린 시간에서 사람 역할 응답 시간을 뺀 합 | 낮음 |
| 모든 Work 사람 행동 | 지식을 모으고 거르는 수고를 포함한 모든 Work의 사람 행동 수 | 낮음 |
| 모든 Work 입력 토큰 | 실행 전체의 에이전트 입력 토큰 | 낮음 |
| 모든 Work 숨긴 시험 | 모든 Work가 통과한 실행의 비율 | 높음 |

도구 문제로 끝난 실행(`harness_error`, `human_error`, Work 하나라도)은 빼고 따로 센다. 시간·차례 제한, 포기는 빼지 않는다(재는 Work가 돌지 못했으면 PM2는 실패).

짝 판정(`report.mjs`의 AI 판정)과 설문은 참고로만 본다.

## 5. 판정 규칙 (마지막 비교에만)

hold-out 두 시나리오에서 `relay`(실험 빌드, 지식 켬)와 `base`를 견준다. 다음 가운데 하나를 채우면 "효과 있음"이다.

- PM1의 95% 구간이 0보다 작고(덜 다시 말함), PM2의 차이가 −10%p 이상이다.
- PM2의 95% 구간이 0보다 크고, PM1의 차이가 +0.25 이하다.

`relay`와 `m17`(M17 빌드)은 같은 표로 견주되 합격·불합격을 정하지 않는다. M17은 팀 지식을 [PR 생성]에서만 커밋하므로, [완료만]으로 끝내는 이 평가의 팀원 교대 Work에서는 M17의 팀 지식이 건너가지 않는다. 그 Work의 M17 수치는 이 한계와 함께 읽는다.

## 6. 견줄 쪽과 마지막 비교

| 쪽 | 빌드 | 만드는 법 |
|---|---|---|
| `relay` | 이 브랜치의 앱 (실험 결과) | `bash app/eval/setup.sh` |
| `relay-off` | 같은 빌드, `RELAY_KNOWLEDGE=off` | (같음) |
| `base` | `0247049` | `bash app/eval/ref-app.sh base 0247049` → `/tmp/relay-ref/base/app` |
| `m17` | `aa39d16` | `bash app/eval/ref-app.sh m17 aa39d16` → `/tmp/relay-ref/m17/app` |

다른 빌드의 사람 역할은 `guides/<이름>.md`가 있으면 그 설명서를 받는다(`base.md`는 이 브랜치에 있고, `m17.md`는 봉인 안에 있다). 실험 빌드의 설명서는 `guides/relay.md`다.

마지막 비교의 차례:

1. 개발을 끝내고 실험 빌드의 커밋을 정한다(이 커밋 뒤로 앱 코드를 고치지 않는다). `log.md`에 적고 push한다.
2. 사람에게 열쇠를 받아 `HOLDOUT_KEY='…' bash app/eval/unseal.sh`.
3. `base`와 `m17` 빌드를 만든다.
4. 돌린다(회차 5):
   ```bash
   cd app
   node eval/run.mjs --scenarios h1-parcel-fees,h2-stay-fees --runs 5 --parallel 2 \
     --arms relay,base,m17 \
     --app base=/tmp/relay-ref/base/app,m17=/tmp/relay-ref/m17/app \
     --pairs relay:base,relay:m17 --out eval/results/final
   node eval/primary.mjs eval/results/final --pair relay:base --out eval/results/final/primary-relay-base.md
   node eval/primary.mjs eval/results/final --pair relay:m17 --out eval/results/final/primary-relay-m17.md
   ```
5. 도구 문제로 빠진 실행은 같은 회차 번호로 다시 돌려 채운다(예산 안에서). 결과를 보고 앱을 고치지 않는다.
6. 보고서를 쓴다(10절).

## 7. 예산

평가 실행(`run.json` 하나, 쪽 하나 × 시나리오 하나 × 회차 하나) **500개 안팎**. 모델 기본값(에이전트 sonnet·medium, 사람 역할 sonnet, 판정 sonnet)으로 돈 실행을 센다. 도구를 확인하려고 haiku로 짧게 돌린 것은 세지 않지만 `log.md`에 적는다. 나눔의 기준:

- 처음 기준 재기(개발용 시나리오 × `relay-off` 또는 `base`): 20개 안팎
- 개발 반복: 400개 안팎. 결정 하나를 평가로 가를 때는 시나리오마다 쪽마다 회차 5를 기준으로 한다(회차 3이면 차이가 표준편차에 묻히기 쉽다)
- 마지막 비교: 30개(2 × 3 × 5)와 다시 돌릴 몫 20개

`log.md`에 실행 수를 누적해 적는다. 450개를 넘기면 개발을 마무리한다.

## 8. 고정 파일과 바꿀 수 있는 것

`node app/eval/frozen.mjs`가 고정 파일의 해시(`app/eval/frozen.json`)를 확인한다. 고정 파일: 이 문서, 지표·보고서·실행·판정·사람 역할·시나리오 확인 도구(`primary.mjs`, `report.mjs`, `run.mjs`, `check-scenario.mjs`, `lib/`의 `ai`, `env`, `episode`, `human`, `judge`, `kind`, `repo`, `util`, `works`), 설명서 `base.md`·`cli.md`, 봉인, 개발용 시나리오 21~24.

- 바꿀 수 있는 것: 앱(`app/src`), 스킬(`skills/`), 설계 문서, 화면을 다루는 도구(`lib/relay-arm.mjs`, `lib/cli-arm.mjs`, `lib/dialogs.mjs`), 실험 빌드의 설명서 `guides/relay.md`, 새 개발용 시나리오.
- `guides/relay.md`는 화면을 어떻게 다루는지만 적는다. 사람 역할이 무엇을 말하거나 말하지 말지(예: "규칙을 다시 말하지 않아도 된다")는 적지 않는다. 마지막 보고서에 이 파일의 바뀐 내용을 그대로 싣는다.
- 고정 파일의 버그를 꼭 고쳐야 하면: 사람에게 알리고, 지표의 정의를 바꾸지 않는 최소한으로 고치고, `log.md`에 까닭을 적고, `node app/eval/frozen.mjs --write`로 다시 적는다. 고치기 전 결과와 뒤 결과를 섞어 결정하지 않는다.

## 9. 기록 (`log.md`)

- 결정마다 `K<번호>`로 적는다: 무엇을 정했나, 견준 안, 근거(결과 폴더, 주지표 표, 실행 수), 평가로 가르지 못했으면 판단의 까닭.
- 평가를 돌릴 때마다: 무엇을 확인하려고, 명령, 결과 폴더, 실행 수와 누적, 주지표 요약, 다음에 할 일.
- 평가 결과 폴더(`app/eval/results/`)의 `report.md`, `primary*.md`, `config.json`과 `run.json`은 커밋한다(스크린샷과 Work 기록은 크면 빼도 된다). 컨테이너는 사라진다.

## 10. 산출물

1. 실험 빌드: 지식 관리가 들어간 앱, 스킬, 설계 문서(`docs/design.md`에 결정을 반영), 시험.
2. `log.md`: 결정과 평가의 기록.
3. 마지막 보고서 `docs/knowledge-experiment/report.md`: 만든 지식 관리의 모습(한 장 요약), 결정의 흐름, 개발용 시나리오의 기준 대비 변화, hold-out 결과(relay 대 base 판정, relay 대 m17 표), 비용(실행 수, 시간), `guides/relay.md`의 바뀐 내용, 한계와 다음에 볼 것.

## 11. 알려진 한계

- 사람 역할과 판정이 AI다. 실제 사람의 지식 공유 습관, 리뷰 부담, 몇 달에 걸친 낡음은 재지 못한다.
- `told`는 사람 역할의 자기 보고다. 입력 글자와 질문 수를 함께 본다.
- 팀원 교대는 [완료만] → 브랜치 머지로 PR을 흉내 낸다. 실제 PR 리뷰와 머지 충돌 해결은 없다.
- hold-out은 시나리오 둘, 회차 5다. 작은 차이는 가르지 못한다.
