# 다음 세션용 프롬프트

아래 내용을 새 세션에 입력한다. [논의 기록](requirements-extraction-flow.md)은 이전 대화 없이 읽을 수 있도록 작성돼 있다.

```text
CheongMyungJ/relay-v2의 docs/requirements-extraction-flow-20261008 브랜치에서 요구사항 추출 Work의 구현 전 녹화와 평가 하네스를 만들자.

먼저 CLAUDE.md, CONTRIBUTING.md, docs/requirements-extraction-flow.md(특히 15.5절의 결정 1~42, 16.11절, 17절)를 읽고, 문서가 인용한 현재 코드와 비교해 전제가 바뀌었는지 확인해줘. 로컬에 없으면 해당 브랜치를 가져와서 읽어줘. 작업 중인 다른 변경은 보존해줘.

목표는 복잡한 레거시 펌웨어에서 AI가 보드·빌드·기능을 스스로 발견하고, 근거가 연결된 기능·비기능 요구사항 후보와 제약을 추출하는 새 requirements type이다. 흐름은 intake → extract → verify이고, extract 안에서 앱이 헤드리스 claude -p run을 돌려 결과를 앱 소유 revision에 반영한다. 설계는 결정 1~42로 정했다. 이미 정한 것은 다시 묻지 말고, 기존 relay 기능·제안·결정을 구분해줘.

extract 스킬 지침이 이 Work의 핵심이고, 고정 계약 문구와 렌즈별 점검표 항목은 평가를 만들고 기준선을 잰 뒤에 쓴다(결정 16). 그래서 이번에는 앱의 requirements 기능이 아니라 그 앞 단계를 만든다.

1. 구현 전 녹화: 16.11절 녹화 1~7, 17.2절과 17.3절의 녹화 항목(도구를 켠 -p의 결과 필드와 종료, --json-schema와 도구의 병용과 $defs/$ref, --append-system-prompt-file, --tools로 AskUserQuestion 빼기, --add-dir 대상의 CLAUDE.md·설정 섞임, 사용량 한도 오류의 재설정 시각, get_usage). CLAUDE.md대로 앱이 쓸 옵션·필드는 app/test/contract/의 계약과 녹화본에 더하고, 가짜 claude에 녹화본에 없는 필드를 지어내지 않는다.
2. 결과 스키마 v0: 17.3절과 결정 35~37, 42대로 survey와 trace(command, timing, variant, shared)의 기본 스키마를 docs/contracts에 두고 run마다 점검표 키를 넣어 조립한다(결정 36). 점검표 ID는 16.6절 초안을 쓴다.
3. 평가(17.1절, 결정 17~23, 28): 손으로 쓴 합성 펌웨어 개발용 픽스처(작은 두 보드 bare-metal부터), 결과 스키마와 뗀 정답 파일, 손으로 쓴 reference.json과 traps/*.json, 결정론 채점과 판정 모델 채점, run 단위 하네스. 기준선은 최소 지시 판이다(결정 19). 하네스는 run마다 get_usage로 주간 사용량을 보고 남은 비율이 50%에 닿거나 읽지 못하면 멈춘다(결정 28). hold-out은 다른 세션이 만들어 봉인하므로(결정 22) 이 세션에서는 만들지도 보지도 않는다.

진행 방식:
- 먼저 현재 이해를 짧게 정리하고, 녹화 항목마다 어디서 돌려야 하는지(이 환경, 구독 로그인한 내 PC, Windows)와 대략의 사용량을 표로 보여줘. 실제 claude를 부르는 녹화나 시범은 돌리기 전에 물어봐줘.
- 결과 스키마 v0의 초안과 첫 픽스처의 함정 목록(17.1절)을 보여주고, 결정이 필요한 것만 추천안과 이유를 붙여 소수씩 물어봐줘. 코드로 확인할 수 있는 것은 먼저 조사해줘.
- 그다음 녹화 → 스키마 v0 → 픽스처·정답·reference/traps → 채점기(app/eval/test/에 시험, 모델 없이 npm run test:eval에서 돎) → 하네스 순으로 작게 커밋해줘. 하네스의 지시·스키마 조립은 앱과 skills/check.mjs가 함께 쓸 모듈로 만든다(16.3절 제안). 다르게 해야 하면 물어봐줘.
- push 전에 app/에서 npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract를 통과시키고, [실제] 시험을 고치면 RELAY_REAL_CLAUDE=dry도 통과하게 해줘. PR은 내가 요청하면 만들어줘.
- 작업 중 정한 것과 이유, 녹화로 확인한 사실은 문서 15.5절의 결정 기록과 해당 절(16.11, 17절)에 바로 갱신해줘. D/I 번호 이전(결정 8)은 앱 기능 구현 PR에서 하므로 이번에는 하지 않는다.

남은 설계 논의(extract task의 상태와 화면, 재개·되감기와 결정 33의 고아 파일 규칙, 서브모듈 안의 근거(D382), intake와 verify의 requirements 구간)는 이 작업 뒤에 이어 간다.
```
