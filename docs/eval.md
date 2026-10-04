# relay 대 맨 CLI 사용성 평가

- 상태: 도구 준비 (평가 결과는 아직 없음)
- 코드: `app/eval/`
- 새 세션에서 돌리기: `.claude/skills/relay-eval/SKILL.md` (예: "시나리오 3번으로 5번 돌려서 평가해줘")

## 1. 목적

버그 수정, 기능 추가(relay D232), 리팩터링(relay D258), 일반(relay D302)에서 relay가 Claude Code CLI를 그냥 쓰는 것보다 얼마나 쓰기 좋은지 본다. 지식 관리는 같은 레포에서 Work 여럿을 잇는 시나리오(21~24)로, 지식을 켠 relay와 끈 relay(또는 다른 빌드)를 견준다. 지식 관리 실험의 규약과 주지표는 `docs/knowledge-experiment/protocol.md`에 있다. 여러 상황(시나리오)을 두 쪽으로 똑같이 돌리고, 사람의 판단은 AI가 대신한다. 결과는 경향을 보는 자료다. 사람 역할과 판정이 AI이므로 실제 사용자 시험을 대신하지 않는다.

## 2. 구성

```
시나리오(버그 레포 + 숨긴 시험 + 사람이 아는 것)
  ├─ relay 쪽: 빌드한 Electron 앱(out/)을 가상 화면에 띄우고 Playwright로 누른다
  ├─ relay-off 쪽: relay와 같고 앱에 RELAY_KNOWLEDGE=off를 준다(지식 관리를 끔, 21~24의 짝)
  ├─ 다른 빌드 쪽(--app 이름=폴더): eval/ref-app.sh로 만든 다른 커밋의 앱. 이름-off는 그 빌드에서 지식을 끔
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
| `eval/lib/episode.mjs` | 실행 하나: 레포 준비, 사람 깨우기, 사건, 판정. Work 둘을 잇는 시나리오는 Work마다 사람 역할을 새로 두고 Work마다 판정한다 |
| `eval/lib/works.mjs` | Work 여럿을 잇는 시나리오(`works`)의 Work 나누기, 팀원 교대, 재는 Work, 시나리오의 짝(relay 대 맨 CLI, relay 대 relay-off) |
| `eval/primary.mjs` | 지식 실험의 주지표와 두 쪽 차이의 bootstrap 구간 (`docs/knowledge-experiment/protocol.md` 4절) |
| `eval/ref-app.sh` | 견줄 다른 커밋의 앱을 git worktree로 꺼내 빌드한다 |
| `eval/frozen.mjs` | 지식 실험에서 고정한 파일의 해시 확인 |
| `eval/unseal.sh` | 봉인한 hold-out을 연다(열쇠는 사람이 줌) |
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
- **같은 깨우기:** 사람은 화면이 바뀌었다가 6초 동안 그대로면 깨어난다(화면이 멈춘 것을 알아챔). 스스로 기다리기로 한 시간이 지나도 깨어나고, 화면이 계속 바뀌어도 4분마다 한 번 들여다본다. relay의 OS 알림은 알림으로 보이고 사람을 깨운다(relay만 가진 기능이므로 그대로 둔다). relay 화면에서 시계만 따라 바뀌는 글자(진행 표시의 경과 시간, `data-tick`, relay D216)는 화면이 바뀐 것으로 보지 않는다. 시계가 도는 것으로는 사람이 멈춤을 알아채지 않기 때문이다. 사람 역할이 보는 화면 글자와 스크린샷에는 그대로 있다.
- **같은 시작점:** relay는 프로젝트가 등록된 앱에서, 맨 CLI는 레포 폴더에서 claude가 떠 있는 상태에서 시작한다. 등록과 첫 실행 창은 도구가 한다.
- **relay 설정:** 앱 설정은 바꾸지 않고 앱의 기본값으로 돈다. M12(relay D214)부터 기본값이 수정과 지적 없는 리뷰를 자동 승인하므로, 그 전의 보고서(`app/eval/reports/`)와 견줄 때 이것을 감안한다.
- **보는 것:** relay의 사람 역할은 스크린샷(요소 번호를 얹은 것), 보이는 글자, 누를 수 있는 요소 목록을 본다. 맨 CLI의 사람 역할은 터미널 화면 글자를 본다(터미널은 글자가 곧 화면이다). 둘 다 지금 보이는 만큼만 본다. 스크린샷은 창(1500×950)을 1000픽셀 너비로 줄인 것이고, 화면 배치(누를 수 있는 요소와 그 상태, 열린 대화상자)가 앞에 붙인 그림과 같으면 다시 붙이지 않는다. 글자와 요소 목록은 차례마다 준다(eval-findings E10). 사람 역할 비용을 줄여 회차를 늘리려는 것이다.
- **코드 보기:** 두 쪽 모두 `inspect_diff`로 바뀐 코드를 볼 수 있다(에디터로 훑어보는 것). 사람의 부담으로 센다.

## 4. 사람 역할

- `claude -p` 세션 하나가 한 실행 내내 같은 사람이다(`--session-id`로 시작, `--resume`으로 잇는다). 시스템 프롬프트를 바꿔 개발자 역할만 한다. 도구는 쓰지 않는다. relay의 스크린샷은 메시지에 그림으로 붙인다(도구로 읽게 하면 자주 건너뛴다). 배치가 바뀐 차례에만 붙이고, 붙이지 않은 차례에는 그렇다고 알린다(3절).
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
| 09-stock-negative | 리포트의 음수 재고, 원인은 취소 경로의 캐시 키(여러 창고 SKU) | 조사가 드러나는 방식, 증상만 막지 않고 원인을 고치는지 |
| 10-invoice-rounding | 회계 규칙(줄마다 부가세 버림)을 물어야만 정답을 앎 | 필요한 규칙을 묻는지, 흔한 해법(반올림)으로 틀리지 않는지 |
| 11-amount-sweep | 리포트 8개에 복사된 파싱 코드를 모두 고치는 도중 비정상 종료 | 반쯤 고친 상태의 파악과 복구, 빠짐없이 끝내는지 |
| 12-flaky-job | CI 전용 시험이 가끔 실패(병렬 결과 짝짓기) | 재현과 근거, 재시도나 순차 실행으로 덮지 않는지 |
| 13-soldout-pivot | "품절 빼 줘"가 도중에 "빼지 말고 맨 뒤로"로 뒤집힘 | 이미 한 수정을 되돌리고 새 방향으로 가기 쉬운지 |
| 14-double-notify | 알림 중복의 원인이 둘(중복 제거 키, 늦은 성공을 재시도) | 첫 원인에서 멈추지 않는지, 조사 범위를 넓히기 쉬운지 |
| 15-csv-delimiter | (기능 추가, 작음) CSV 내보내기에 구분자 옵션 | 작은 기능에서 설계와 계획 단계가 부담인지(relay D233), 승인 수와 시간 |
| 16-product-filter | (기능 추가, 중간) 상품 목록에 가격 범위 필터와 정렬. 같은 가격의 차례와 잘못된 범위의 처리는 사람만 앎 | 설계가 밖에서 보이는 동작의 선택지를 묻는지(D242), 기존 호출을 깨지 않는지 |
| 17-audit-log | (기능 추가, 큼) 사용자 서비스에 감사 로그와 조회. 이메일 가리기, 조회 차례, 실패 기록 규칙은 사람만 앎 | 설계가 비기능 관점(보안)을 훑어 묻는지(D246), 계획을 나눠 테스트를 먼저 쓰는지(D247), 산출물로 확인하기 쉬운지 |
| 18-extract-price | (리팩터링, 작음) 두 곳에 있는 줄 가격 계산을 함수 하나로 뺌. 함정: 반올림 위치를 합계 뒤로 옮김 | 작은 리팩터링에서 안전망 커밋과 계획이 부담인지(relay D258, D259), 승인 수와 시간 |
| 19-split-report | (리팩터링, 중간) 보고서 함수를 읽기·집계·출력 모듈로 나눔. 0원 행만 있는 분류가 빠지는 버그는 사람이 알고 따로 고칠 예정 | 찾은 버그를 고치지 않고 적는지(D260), 안전망이 경계를 잡는지(D268) |
| 20-order-events | (리팩터링, 큼) 주문의 직접 호출을 이벤트 구독으로 바꿈. 메일 오류가 placeOrder까지 와야 한다는 것과 적립이 먼저라는 것은 사람만 앎 | 구조를 바꾸면 달라지는 동작을 묻는지(D270), 구독자 오류를 삼키는 흔한 방식으로 동작을 바꾸지 않는지 |
| 21-invoice-credit | (지식, Work 둘) Work 1은 10과 같고 사람이 회계 규칙을 알려 줌. Work 2는 같은 레포의 반품 전표 부가세가 몇 원씩 어긋남(같은 규칙이 필요, 반올림·합계 버림·할인 전 금액은 틀림) | 지식을 켠 relay가 Work 2에서 규칙을 다시 묻지 않고(사람 차례, AskUserQuestion 수) 같은 실수 없이 고치는지, relay-off와 견줌 |
| 22-flaky-retry | (지식, Work 둘) Work 1은 12 그대로(병렬 결과 짝짓기, 재시도·skip·시간 제한 금지를 처음에 들음). Work 2는 보고서 보관의 CI 전용 시험이 가끔 ENOENT로 실패(임시 파일 이름을 시각으로 지어 동시 저장끼리 겹침). 규칙은 물어야만 앎 | 지식을 켠 쪽이 Work 2에서 규칙을 다시 묻지 않는지(사람 차례, AskUserQuestion 수), ENOENT 재시도나 순차 실행으로 덮지 않고 원인을 고치는지 |
| 23-double-notify-digest | (지식, Work 둘) Work 1은 14의 알림 중복. Work 2는 요약 메일 중복으로, 원인이 같은 모양으로 둘이다(발송 기록 키에 실행 id가 들어가 요약이 다시 돌면 또 보냄, 제한 시간을 넘긴 성공을 시간 초과로 보고 다시 보냄) | 지식을 켜면 Work 2에서 사람이 밀어주지 않아도 두 원인을 다 찾는지, 끈 쪽(relay-off)보다 사람 차례와 질문이 줄어드는지 |
| 24-invoice-credit-teammate | (지식, Work 둘, 팀원 교대) 21과 같은 두 일인데 Work 2를 팀원이 한다. 도구가 Work 1의 브랜치를 main에 머지하고 새 clone, 새 앱 저장소에서 시작한다. 팀원은 회계 규칙을 모른다 | 레포로 건너간 팀 지식만으로 Work 2가 규칙대로 고쳐지는지(숨긴 시험), 끈 쪽과 견줌 |
| 28-ci-matrix | (일반, 설정) CI를 Node 20·22 행렬로 바꾸고 lint 단계를 더함. 아직 Node 18을 지원해야 한다는 것은 사람만 앎 | 확인 방법을 갖춘 완료조건(relay D305)과 verify의 판정, 지금 CI의 18을 빼도 되는지 묻는지(D308) |
| 29-money-upgrade | (일반, 의존성) vendored 금액 라이브러리를 1.4.0에서 2.0.0으로 올림. 새 판의 기본 반올림이 half-even으로 바뀌었고 기존 테스트가 덮지 않음. 부가세 사사오입 규정은 사람만 앎 | 확인 방법이 `npm test`뿐일 때 verify가 보완해 판정하는지(D312), 회계 규정을 묻는지 |
| 30-discount-merge | (일반, 섞인 일) 회원 할인 5%→7%와 흩어진 할인 계산 모으기. 미리보기와 결제의 쿠폰·할인 차례가 다르고, 쿠폰 먼저가 맞다는 것은 사람만 앎 | 동작 변경과 구조 정리가 섞인 일에서 밖에서 보이는 선택을 묻는지(D308) |

`scenario.json`의 필드:

| 필드 | 뜻 |
|---|---|
| `id`, `title`, `purpose` | 이름과 평가 목적 |
| `type` | 업무 유형: `bugfix`(버그 수정) / `feature`(기능 추가) / `refactor`(리팩터링) / `general`(일반). 없으면 `bugfix`다(relay I62, I67, I92). 사람 역할에게 일의 종류로 알리고, relay 쪽 사람 역할은 새 Work 대화상자에서 그 유형을 고른다. 판정과 설문의 낱말도 이것을 따른다(`eval/lib/kind.mjs`) |
| `repoName` | 레포 폴더 이름 (relay 프로젝트 이름이 된다) |
| `report` | 사람이 받은 리포트나 본 것, 기능 추가와 리팩터링이면 요청 (문자열 또는 문자열 배열) |
| `knowledge` | `{ share: "upfront" \| "on_ask", text }` |
| `preferences` | 사람의 선호 |
| `reveals` | `{ when, afterSeconds, text }`: 때가 되면 사람에게 새로 떠오른 요구로 알린다 |
| `events` | `{ when, afterSeconds, do: "crash" }`: relay는 앱을 SIGKILL하고 다시 띄운다. 맨 CLI는 셸과 claude를 프로세스 그룹째 끝내고 같은 폴더에서 새 셸을 연다 |
| `when` | `first_change`(작업 폴더에 처음 커밋이나 변경이 생긴 때) 또는 `elapsed`(시작부터) |
| `expectedFiles` | 바뀌어도 되는 파일(glob). 나머지는 "기대 밖 파일"로 센다 |
| `checks` | `{ name, file, env?, bug?, guard? }`: `hidden/<file>`을 `node --test`로 돌린다. `env`로 TZ 같은 환경을 준다. `guard`는 기준에서도 통과하는 지키기 시험이다(멀쩡한 동작을 깨지 않았는지) |
| `limits` | `{ minutes, turns }`. `works`가 있으면 Work마다의 제한이다 |
| `works` | Work 여럿을 잇는 시나리오: Work마다 `{ report, knowledge, checks, teammate? }`를 차례로 둔다. 이때 맨 위의 `report`, `knowledge`, `checks`는 두지 않는다. 숨긴 시험 이름은 시나리오 안에서 겹치지 않는다. `teammate: true`인 Work는 팀의 다른 사람이 한다(아래) |
| `knowledge[].carry` | 앞 Work에서 사람이 이미 알려 줬던 사실. 사람 역할이 이것을 다시 알려 주면 `carriedTold`로 센다 |
| `measure` | 재는 Work의 번호(1부터). 없으면 첫 Work를 뺀 모두 |

시나리오를 더할 때: `repo/`의 `npm test`는 기준 상태에서 통과해야 한다(리포트의 버그를 잡지 않는 시험). 숨긴 시험은 `../src/...`로 불러온다(레포의 `eval-hidden/`에 복사해 돌린다). `guard`가 아닌 숨긴 시험은 기준 상태에서 실패해야 한다.

**Work 둘을 잇는 시나리오(`works`):** 한 실행이 같은 레포(relay는 같은 앱과 프로젝트)에서 Work 1을 끝낸 뒤 Work 2를 한다. 사람 역할은 Work마다 새 세션이고 그 Work의 리포트와 아는 것만 받는다(같은 사람이므로 Work 1에서 알려 준 규칙은 Work 2에서도 "물으면 답함"으로 둔다). relay 쪽 사람은 앞 Work를 끝낸 뒤 같은 프로젝트에서 [새 Work]로 시작하고, 맨 CLI 쪽은 도구가 앞 터미널을 닫고 같은 레포 폴더에서 claude를 새로 띄운다. 두 번째 Work부터는 다음 Work로 넘긴 뒤 에이전트가 일한 기록(대화 기록의 메시지)이 늘지 않았으면 도구가 사람의 `done`을 받지 않고 "아직 시작하지 않았다"고 돌려준다(행동 수와 헛동작으로 세지 않고 `refusedDone`으로 세며, 보고서의 Work 표에 보인다. 맨 CLI는 새로 띄울 때 세션이 생기고 그 세션에서 일할 수 있어 새 세션이 있는지로 보지 않는다). 2026-10-02 평가에서 사람 역할이 화면에 남은 앞 Work의 완료 화면을 이번 일로 읽고 [새 Work] 없이 끝내, Work 2가 돌지 않은 채 앞 Work의 worktree로 판정된 일이 18회 중 6회 있었다. 평가는 맨 CLI의 자동 메모리를 끄지 않으므로, 그 쪽은 CLI 자체 메모리가 Work 1의 정보를 얼마나 잇는지 보는 참고다. 짝 판정은 relay 대 relay-off다(`--pairs`로 바꿀 수 있다). relay의 Work 2는 기준 브랜치(main)에서 시작하고 Work 1의 수정은 들어 있지 않으므로([완료만]은 머지하지 않음), Work 2의 숨긴 시험은 Work 2의 수정만으로 통과해야 한다.

**팀원 교대(`teammate: true`):** 그 Work 전에 도구가 앞 사람 레포의 브랜치 가운데 main에 없는 커밋이 있는 것을 오래된 차례로 main에 머지하고(PR 머지 흉내, 충돌하면 뒤 브랜치 쪽으로 머지하고 `handoffs`에 적음), 팀 원격(bare)에 올린 뒤 새로 clone한다. relay는 새 앱 저장소(`RELAY_HOME`)와 새 Electron 사용자 폴더로 그 clone을 프로젝트로 등록해 두고, 맨 CLI는 그 폴더에서 claude를 새로 띄운다. 커밋하지 않은 변경과 앱 저장소에만 있는 것은 건너가지 않는다. 레포 경로가 바뀌어 Claude Code의 프로젝트 메모리도 이어지지 않는다. 사람 역할은 Work를 [완료만]으로 끝내므로 Work 브랜치에 커밋된 것만 다음 사람에게 간다. 팀원 교대 뒤의 Work는 앞 Work의 정답이 머지된 상태에서 판정하므로, `check-scenario.mjs`가 `reference-1..n`을 차례로 모두 적용해도 모든 시험이 통과하는지 확인한다.

**다시 알려 줌(`told`):** 사람 역할은 차례마다 "네가 아는 것"의 몇 번 항목을 새로 알려 줬는지 `told`에 적는다(에이전트가 먼저 꺼낸 것을 맞다고만 한 것은 빼고). Work마다 `told`, `carriedTold`(다시 알려 준 carry 항목 수), `carriedTotal`을 `workResults[].human`에 둔다.

시나리오 폴더에 `reference.patch`(정답 수정)와 `traps/*.patch`(그럴듯한 틀린 수정)를 둘 수 있다. Work 둘을 잇는 시나리오는 Work마다 `reference-<n>.patch`를 둔다. `repo/`를 뿌리로 한 git diff이고, 평가 도구는 `repo/`만 복사하므로 에이전트에게 보이지 않는다. `node eval/check-scenario.mjs <id>`가 확인한다: 기준에서 `npm test`와 guard는 통과하고 나머지 숨긴 시험은 실패, 정답 패치에서 모두 통과, 함정 패치마다 숨긴 시험 하나 이상 실패. `reference-<n>.patch`는 그것만 적용하면 n번째 Work의 숨긴 시험과 guard, `npm test`가 통과하고 다른 Work의 guard가 아닌 숨긴 시험은 실패해야 한다(Work마다 고칠 것이 갈림). 09~14의 설계는 `docs/eval-hard-scenarios.md`에 있다.

## 6. 판정과 지표

- **Work 둘을 잇는 시나리오:** 위 지표는 실행 전체로 세고, Work마다 따로 숨긴 시험(relay는 그 Work에서 생긴 worktree, 맨 CLI는 레포와 브랜치 모두로 판정), 사람 차례·행동·입력, 에이전트 질문 수(대화 기록의 `AskUserQuestion` 도구 호출), 그 Work에서 생긴 에이전트 세션의 토큰, relay의 `context.md` 글자와 넣은 지식 글자(앱이 task 폴더에 `knowledge-injected.md`를 남기면 그 글자, 없으면 `context.md`의 `## 참고 지식` 절)를 `run.json`의 `workResults`에 둔다. 보고서는 Work마다 표를 두고 재는 Work(`measure`)를 앞에 보인다. 설문은 Work마다 하고, 짝 판정은 마지막 Work의 설문을 본다.
- **relay의 지식 파일(`docs/knowledge/*.md`, relay D283):** 앱이 verify에서 남기는 팀 지식이라 코드 결과로 보지 않는다. 바뀐 파일과 줄 수, 기대 밖 파일, 결과 판정의 코드 차이에서 빼고 "지식 파일 수(판정에서 뺌)"로 따로 센다(`eval/lib/repo.mjs`의 `KNOWLEDGE_FILE`). 맨 CLI에는 없는 파일이라 판정에 두면 결과 판정의 가림도 깨진다. 2026-10-04 M18 평가에서 판정 모델이 이 파일을 범위 밖 변경으로 보고 relay의 scope를 깎아 바꿨다. 저장하는 `final/*.diff`에는 그대로 두어 지식의 질은 `knowledge-quality.mjs`가 따로 본다. 그 전에 돌린 결과도 `report.mjs --rejudge`로 같은 규칙으로 다시 판정할 수 있다.
- **결과(자동):** 숨긴 시험, 레포 시험, 바뀐 파일과 줄 수, 기대 밖 파일, 커밋 여부. relay는 Work마다 worktree가 있으므로 결과 폴더가 여럿일 수 있다. 맨 CLI도 에이전트가 버그마다 브랜치를 나누면 고친 것이 흩어지므로, 평가 레포(체크아웃된 브랜치)에 더해 체크아웃되지 않은 로컬 브랜치 가운데 기준 뒤에 커밋이 있고 HEAD에 아직 들어 있지 않은 것을 `git archive`로 꺼내 결과 폴더로 삼는다. 고친 것을 보는 시험은 한 곳에서라도 통과하면 통과이고, `guard` 시험은 바뀐 결과 폴더 모두에서 통과해야 통과다(바뀐 폴더가 없으면 모든 폴더). worktree가 [Work 정리]로 지워져도 판정할 수 있게 사람의 차례마다 복사해 둔다.
- **사람의 부담(자동):** 차례 수, 행동 수, 입력 글자 수, 코드 보기, 헛동작(쪽이 실패로 돌려준 행동: 없는 요소, 열린 터미널 없음 등), friction, 걸린 시간.
  - 걸린 시간에는 평가 고리가 사람 역할(AI)의 답을 기다린 시간이 들어 있다. 보고서는 사람 역할 응답 시간의 합과 그것을 뺀 시간을 따로 보인다. 기다리기만 한 차례(행동이 `wait`뿐이거나 없음)도 센다. 진행 표시(relay D216)처럼 화면이 계속 바뀌면 깨우는 횟수가 기계적으로 달라지므로, 개선 전후는 이 줄과 사람 역할의 말로 견준다(eval-findings E2).
  - 스크린샷을 붙인 차례 수(relay만)를 센다(E10).
- **에이전트(자동):** 설정 폴더의 대화 기록에서 토큰(같은 메시지 id는 마지막 줄 하나. Claude Code는 메시지 하나를 여러 줄에 쓰고 앞 줄의 출력 토큰은 다 세지 않은 값이다), 세션 수.
  - relay는 task마다 세션 id로 대화 기록을 맞춰 단계별 토큰(입력(캐시 포함), 캐시 쓰기, 출력)과 `context.md` 글자 수를 `run.json`의 `agentSteps`에 두고, 보고서의 "relay 단계별 에이전트" 표에 단계마다 평균으로 보인다(eval-findings R9). 대화 기록을 찾지 못한 세션은 빼고 센다.
- **설문:** 4절.
- **짝 판정:** 같은 시나리오 같은 회차의 relay와 맨 CLI(21~24는 relay와 relay-off, `--pairs`를 주면 그 짝들)를 A, B로 무작위로 놓고 판정 모델이 비교한다.
  - 결과 판정(가림): 코드 차이와 시험 결과만 본다. 커밋 메시지는 보이지 않는다. correctness, scope, quality, tests (1~5), 선호.
  - 경험 판정: 차례 기록과 설문을 본다. 기록에 도구가 드러나므로 가릴 수 없다. burden, clarity, control, recovery, confidence, overall의 우세와 점수(1~10).

## 7. 돌리기

```bash
bash app/eval/setup.sh                                  # 새 세션마다 한 번
cd app
node eval/run.mjs --list
node eval/run.mjs --scenarios 3 --runs 5 --parallel 2   # 시나리오 3을 두 쪽 5번씩
node eval/run.mjs --scenarios 1,5,6 --runs 2 --effort medium
node eval/run.mjs --scenarios 21,22,23,24 --runs 3 --parallel 2   # 지식 관리: relay 대 relay-off (기본 짝)
bash eval/ref-app.sh base 0247049                                 # 견줄 빌드 → /tmp/relay-ref/base/app
node eval/run.mjs --scenarios 21,24 --runs 3 --arms relay,base --app base=/tmp/relay-ref/base/app --pairs relay:base
node eval/primary.mjs eval/results/<폴더> --pair relay:relay-off # 주지표와 구간
node eval/run.mjs --scenarios 1,10,15,16,18,19 --runs 3 --arms relay,relay@general --pairs relay:relay@general --parallel 2  # 교차 비교(relay I93)
node eval/report.mjs eval/results/<폴더>                # 보고서 다시 만들기
```

- 기본값: 에이전트 `sonnet`·effort `medium`, 사람 역할 `sonnet`·effort `medium`, 판정 `sonnet`.
- **교차 비교(relay I93):** `--arms`의 relay 쪽 뒤에 `@<유형>`을 붙이면(`relay@general`) 사람 역할이 시나리오의 유형 대신 그 유형으로 새 Work를 만든다(설명서에 "이번 평가 조건"으로 알린다). 같은 빌드에서 `relay`와 `relay@general`을 함께 돌리고 짝 `relay:relay@general`을 판정해, 전용 유형과 일반 유형의 수고와 결과 확신을 견준다. 맨 CLI는 유형이 없어 다시 돌리지 않는다. 결과 폴더는 `<시나리오>/relay@general-<회차>/`이고 보고서의 쪽 이름은 "relay (일반 유형)"이다.
- 결과: `app/eval/results/<시각>/`(git에 넣지 않음). `report.md`, `report.json`, `config.json`, `<시나리오>/<쪽>-<회차>/`에 `run.json`(relay의 단계별 토큰 `agentSteps` 포함), `turns.jsonl`(차례 기록), `shots/`(relay 스크린샷), `final/*.diff`, `works/`(relay 산출물과 `pty.log`), `<시나리오>/judge-<회차>.json`.
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


2026-10-02: Work 둘을 잇는 시나리오(`works`)와 relay-off 쪽을 더한 뒤 가짜 `claude`로 21-invoice-credit을 relay, relay-off, 맨 CLI로 한 번씩 돌려 Work 1 → Work 2, Work마다의 판정과 보고서를 확인했다(도구 확인만).
