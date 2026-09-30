# relay-v2

Claude Code 또는 Codex CLI를 PTY 터미널로 실행하고, 단계별 산출물·handoff를 확인해 승인하는 데스크톱 앱입니다.

## 엔진 선택

설정의 **기본 엔진**에서 Claude Code / Codex를 선택합니다. 새로 만드는 task부터 적용되므로 같은 Work의 다음 단계에서 엔진을 바꿀 수 있습니다. 실행·대기 중인 task와 재개하는 task는 원래 엔진을 유지합니다. 기존 엔진 기록이 없는 task는 Claude로 읽습니다.

- Claude Code: 기존 실행과 질문, 자동 승인 설정을 유지합니다.
- Codex: CLI를 설치하고 로그인한 뒤 선택합니다. 미설치·로그아웃·필수 기능 미지원은 점검에서 안내하며 다른 엔진으로 자동 전환하지 않습니다. 별도 설치 위치는 `CODEX_BIN`으로 지정할 수 있습니다.
- Codex 작업은 사람이 승인합니다. 자동 승인 설정은 Claude 작업에 적용됩니다. PR 대응의 자동 시작은 Codex에서도 사용할 수 있지만 push와 답글 게시는 사람이 승인한 뒤 실행합니다.

Codex 첫 실행에서는 터미널의 폴더 접근 및 훅 신뢰 안내를 직접 확인하세요. `/hooks`에서 relay 훅을 검토하고 신뢰해야 앱의 도구 보호와 종료 판정이 적용됩니다. 앱은 신뢰 확인을 대신 수락하지 않습니다. Codex 질문은 앱 질문창으로 표시하며, 실제 답변을 보낼 때까지 기다립니다. 추천 선택지는 자동 선택하지 않고 취소를 동의로 처리하지 않습니다.

## 개발 및 검증

`app/`에서 `npm ci`, `npm run dev`로 개발 앱을 실행합니다. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`로 검증합니다. GUI 스모크는 빌드 후 `npm run test:smoke`로 실행하며 Linux에서는 DISPLAY가 필요합니다. Windows 설치 파일은 기존 수동 `app-build` 워크플로로 빌드합니다.

설계, 엔진 간 차이와 검증 결과는 [엔진 확장 문서](docs/engines.md)에 기록합니다. Windows 설치본의 두 엔진 스모크는 통과했으며, 실제 Codex CLI의 relay MCP 연결도 확인했습니다. Linux 앱에서 실제 세션 ID 기록, 중단·앱 재시작 후 같은 ID로 재개, 기본 엔진 변경 후 Codex 유지, `/clear` 뒤 새 ID 기록을 확인했습니다. 실제 모델의 질문·산출물 작성·도구/종료 훅·압축 검증은 인증 갱신 문제로 남아 있습니다. 가짜 CLI 시험 결과를 실제 모델 호환 검증으로 간주하지 않습니다.
