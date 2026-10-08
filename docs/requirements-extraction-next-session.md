# 다음 세션용 프롬프트

아래 내용을 새 세션에 입력한다. [논의 기록](requirements-extraction-flow.md)은 이전 대화 없이 읽을 수 있도록 작성돼 있다.

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서 요구사항 추출 Work의 구현 전 녹화와 평가를 끝까지 만들고 돌린 뒤 보고해줘. 중간에 나에게 묻지 말고, 결정이 필요하면 아래 규칙대로 네가 정하고 진행해.

먼저 CLAUDE.md, CONTRIBUTING.md, docs/requirements-extraction-flow.md(특히 15.5절의 결정 1~42, 16.11절, 17절)를 읽고, 문서가 인용한 현재 코드와 비교해 전제가 바뀌었는지 확인해줘. 로컬에 없으면 해당 브랜치를 가져와서 읽어줘. 작업 중인 다른 변경은 보존해줘.

목표는 복잡한 레거시 펌웨어에서 AI가 보드·빌드·기능을 스스로 발견하고, 근거가 연결된 기능·비기능 요구사항 후보와 제약을 추출하는 새 requirements type이다. 흐름은 intake → extract → verify이고, extract 안에서 앱이 헤드리스 claude -p run을 돌려 결과를 앱 소유 revision에 반영한다. 설계는 결정 1~42로 정했다. extract 스킬 지침이 핵심이고, 고정 계약 문구와 렌즈별 점검표 항목은 기준선을 잰 뒤에 쓴다(결정 16). 이번에는 앱의 requirements 기능이 아니라 그 앞 단계를 만든다.

할 일(이 순서로):
1. 구현 전 녹화: 16.11절 녹화 1~7, 17.2절과 17.3절의 녹화 항목(도구를 켠 -p의 결과 필드와 종료, --json-schema와 도구의 병용과 $defs/$ref, --append-system-prompt-file, --tools로 AskUserQuestion 빼기, --add-dir 대상의 CLAUDE.md·설정 섞임, 사용량 한도 오류의 재설정 시각, get_usage). 앱이 쓸 옵션·필드는 CLAUDE.md대로 app/test/contract/의 계약과 녹화본에 더하고, 가짜 claude에 녹화본에 없는 필드를 지어내지 않는다. 이 환경에서 할 수 없는 것(구독 로그인에서의 get_usage, Windows claude.cmd의 argv 길이 등)은 보수적으로 가정하고 넘어가되, 가정과 확인 방법을 문서와 보고에 남긴다.
2. 결과 스키마 v0: 17.3절과 결정 35~37, 42대로 survey와 trace(command, timing, variant, shared)의 기본 스키마를 docs/contracts에 두고 run마다 점검표 키를 넣어 조립한다(결정 36). 점검표 ID는 16.6절 초안을 쓴다.
3. 평가(17.1절, 결정 17~23, 28): 손으로 쓴 합성 펌웨어 개발용 픽스처 둘(작은 두 보드 bare-metal, 중간 RTOS·ISR·DMA·프로토콜), 결과 스키마와 뗀 정답 파일, 손으로 쓴 reference.json과 traps/*.json, 결정론 채점과 판정 모델 채점(app/eval/test/에 시험, 모델 없이 npm run test:eval에서 돎), run 단위 하네스. 지시·스키마 조립은 앱과 skills/check.mjs가 함께 쓸 모듈로 만든다(16.3절 제안).
4. 측정: 최소 지시 판(결정 19)으로 기준선과 A/A를 쪽·시나리오마다 회차 5로 돌리고(결정 22), 그 결과로 주지표 한도의 숫자를 정한다(결정 23). run 하나의 비용·시간도 기록해 예산 기본값(결정 30)을 보정한다. 지침 문구(L1, 렌즈 카드)는 쓰지 않는다. hold-out은 다른 세션이 만들어 봉인하므로(결정 22) 만들지도 보지도 않는다.

스스로 정하는 규칙:
- 결정 1~42와 기존 relay의 선례에 가장 잘 맞는 안을 고른다. 결정 1~42는 다시 열지 않는다. 녹화 결과가 어떤 결정과 부딪치면 가장 덜 바꾸는 길로 진행하고, 부딪친 내용을 문서와 보고에 적는다.
- design.md에서 ✅인 결정(예: D129, D382)은 바꾸지 않는다. 바꿔야 할 것 같으면 우회하고 보고에 올린다.
- 네가 정한 것은 문서 15.5절에 이어 번호로 적고 "AI가 정함"이라고 표시한다. 고른 안, 이유, 버린 대안을 함께 적어 내가 나중에 검토할 수 있게 한다.

실제 claude 사용량:
- 녹화와 측정에 실제 claude를 부르는 것은 묻지 않고 해도 된다.
- 하네스는 run마다 get_usage로 주간 사용량을 보고 남은 비율이 50%에 닿으면 멈춘다(결정 28). 이 환경처럼 get_usage가 사용량을 주지 않으면, 멈추는 대신 이 세션에서 실제 claude를 부르는 횟수를 녹화·측정·판정을 합쳐 150회 이하로 묶는다. 이 대체를 문서에 적는다.
- 사용량 한도 오류가 나면 5시간 창은 재설정까지 기다렸다 잇고, 주간 한도면 멈춘다. 멈췄으면 그때까지 한 것을 정리해 보고한다.

작업 방식:
- 작게 커밋하고 자주 push한다. 진행 상황과 다음에 할 일을 문서(17절)에 적어, 대화가 끊기거나 압축돼도 이어 갈 수 있게 한다. PR은 만들지 않는다.
- push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract를 통과시키고, [실제] 시험을 고치면 RELAY_REAL_CLAUDE=dry도 통과하게 한다. 스킬을 고치면 skills/에서 node check.mjs를 돌린다.
- D/I 번호 이전(결정 8)은 앱 기능 구현 PR에서 하므로 이번에는 하지 않는다.

끝나면 한 번에 보고해줘:
- 만든 것과 위치, 통과한 시험
- 녹화로 확인한 사실과 확인하지 못한 것(내 PC에서 할 일)
- 네가 정한 결정 목록(번호, 고른 안, 이유)
- 기준선과 A/A 결과, 정한 주지표 한도, run당 비용·시간과 예산 기본값 보정안
- 실제 claude 사용 횟수
- 위험과 다음 단계(지침 문구 작성, hold-out을 만들 세션, 남은 설계 논의: extract task의 상태와 화면, 재개·되감기와 결정 33의 고아 파일 규칙, 서브모듈 안의 근거(D382), intake와 verify의 requirements 구간)
- 마지막으로 docs/requirements-extraction-next-session.md를 다음 단계용 프롬프트로 갱신해줘.
```
