# relay-v2

Claude Code 또는 Codex CLI를 PTY 터미널로 실행하고, 단계별 산출물·handoff를 확인해 승인하는 데스크톱 앱입니다.

새 Work에서 업무 유형을 고릅니다. 버그 수정은 의도 정리 → 원인 분석과 수정 → 리뷰와 검증, 기능 추가는 의도 정리 → 설계와 계획 → 구현 → 리뷰와 검증, 리팩터링은 의도 정리 → 계획과 리팩터링 → 리뷰와 검증, 일반(다른 유형에 맞지 않는 일)은 의도 정리 → 실행 → 리뷰와 검증을 지납니다([설계 D232~D256, D258~D278, D302~D319](docs/design.md)). 리팩터링은 지금 동작을 잡는 안전망 테스트를 먼저 커밋한 뒤 구조를 바꾸고, 동작은 바꾸지 않습니다.

일하는 동안 알게 된 규칙과 사실은 레포의 `docs/knowledge/`에 한 항목 한 파일로 남기고 다음 Work의 단계에 넣습니다. 팀은 이 파일을 PR로 함께 씁니다([설계 3.6, D283~D301](docs/design.md)). 환경 변수 `RELAY_KNOWLEDGE=off`로 끌 수 있습니다.

## 시작하기

### 사전 준비

| 항목                                                            | 필요 여부        | 비고                                                                                                                |
| --------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Node.js 22                                                      | 소스로 실행할 때 | npm 포함. CI와 같은 버전입니다                                                                                      |
| git                                                             | 필수             | 등록할 프로젝트는 git 레포의 루트여야 합니다                                                                        |
| [Claude Code](https://code.claude.com/docs/en/setup) (`claude`) | 필수(기본 엔진)  | 설치 후 터미널에서 `claude`를 한 번 실행해 로그인합니다. 앱은 `claude auth status`가 성공해야 프로젝트를 등록합니다 |
| [GitHub CLI](https://cli.github.com/) (`gh`) 2.48.0 이상        | 선택             | `gh auth login`으로 로그인합니다. 없으면 [PR 생성]과 PR 대응만 쓸 수 없습니다                                       |
| [Codex CLI](https://developers.openai.com/codex/cli) (`codex`)  | 선택             | 기본 엔진을 Codex로 바꿀 때만 필요합니다. 설치 후 로그인합니다                                                      |

준비가 됐는지 확인합니다.

```bash
node -v                              # v22.x
git --version
claude --version && claude auth status
gh --version && gh auth status       # 선택
```

### 실행

소스에서 개발 앱으로 실행합니다. `npm ci`가 node-pty(터미널용 네이티브 모듈)와 Electron 바이너리도 받습니다.

```bash
git clone https://github.com/CheongMyungJ/relay-v2.git
cd relay-v2/app
npm ci
npm run dev
```

Windows 설치 파일은 공개 배포본이 없습니다. GitHub Actions에서 `app-build` 워크플로를 수동 실행하면 실행 결과의 Artifacts에 `relay-setup-<커밋>`이 올라옵니다. 내려받은 `relay-setup-*.exe`는 관리자 권한 없이 `%LOCALAPPDATA%\Programs\relay`에 설치됩니다. 코드 서명이 없어 Windows SmartScreen 경고가 뜰 수 있고 자동 업데이트도 없습니다. 로컬 Windows에서는 `app/`에서 `npm run dist:win`으로 같은 파일을 `app/dist/`에 만들 수 있습니다.

검증된 환경은 Windows(설치본)와 Linux(개발 앱)입니다.

### 첫 사용

1. **프로젝트 등록**: 작업할 레포의 루트 폴더를 고르면 점검 표가 나옵니다. git 레포 루트인지, 엔진에 로그인했는지, 이미 등록된 경로가 아닌지는 통과해야 등록됩니다. origin 원격과 gh 점검은 실패해도 등록되며, 이때는 [push]·[PR 생성]이 막힙니다.
2. **새 Work**: 업무 유형(버그 수정, 기능 추가, 리팩터링, 일반)을 고르고 할 일을 적습니다.
3. **단계 승인**: 각 단계가 끝나면 산출물과 handoff를 확인하고 승인해야 다음 단계로 넘어갑니다.

### 환경 변수

| 변수                  | 설명                                          |
| --------------------- | --------------------------------------------- |
| `RELAY_HOME`          | 앱 데이터 위치. 기본은 사용자 폴더의 `.relay` |
| `CLAUDE_BIN`          | `claude`가 PATH에 없을 때 실행 파일 경로      |
| `CODEX_BIN`           | `codex`가 PATH에 없을 때 실행 파일 경로       |
| `RELAY_KNOWLEDGE=off` | 지식 기능(`docs/knowledge/`)을 끕니다         |

## 엔진 선택

설정의 **기본 엔진**에서 Claude Code / Codex를 선택합니다. 새로 만드는 task부터 적용되므로 같은 Work의 다음 단계에서 엔진을 바꿀 수 있습니다. 실행·대기 중인 task와 재개하는 task는 원래 엔진을 유지합니다. 기존 엔진 기록이 없는 task는 Claude로 읽습니다.

- Claude Code: 기존 실행과 질문, 자동 승인 설정을 유지합니다.
- Codex: CLI를 설치하고 로그인한 뒤 선택합니다. 미설치·로그아웃·필수 기능 미지원은 점검에서 안내하며 다른 엔진으로 자동 전환하지 않습니다. 별도 설치 위치는 `CODEX_BIN`으로 지정할 수 있습니다.
- Codex 작업은 사람이 승인합니다. 자동 승인 설정은 Claude 작업에 적용됩니다. PR 대응의 자동 시작은 Codex에서도 사용할 수 있지만 push와 답글 게시는 사람이 승인한 뒤 실행합니다.

Codex 첫 실행에서는 터미널의 폴더 접근 및 훅 신뢰 안내를 직접 확인하세요. `/hooks`에서 relay 훅을 검토하고 신뢰해야 앱의 도구 보호와 종료 판정이 적용됩니다. 앱은 신뢰 확인을 대신 수락하지 않습니다. Codex 질문은 앱 질문창으로 표시하며, 실제 답변을 보낼 때까지 기다립니다. 추천 선택지는 자동 선택하지 않고 취소를 동의로 처리하지 않습니다.

## 개발 및 검증

`app/`에서 `npm ci`, `npm run dev`로 개발 앱을 실행합니다. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`로 검증합니다. GUI 스모크는 빌드 후 `npm run test:smoke`로 실행하며 Linux에서는 DISPLAY가 필요합니다. Windows 설치 파일은 기존 수동 `app-build` 워크플로로 빌드합니다.

설계, 엔진 간 차이와 검증 결과는 [엔진 확장 문서](docs/engines.md)에 기록합니다. Windows 설치본의 두 엔진 스모크를 통과했고, Linux 앱에서는 실제 Codex 모델로 의도 정리 → 수정 → 리뷰 → 최종 검증 → Work 완료를 진행했습니다(단계를 셋으로 줄인 v0.7 이전 흐름, [설계 D227~D229](docs/design.md)). 실제 질문·답변·취소, 보호 훅, handoff 형식 오류 되돌림, 압축, 중단·앱 재시작 후 동일 세션 재개도 확인했습니다. Windows 실제 모델과 사용자 훅 병합 등 남은 검증 범위는 문서에 구분합니다.
