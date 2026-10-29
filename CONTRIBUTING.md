# relay 개발 안내

relay를 고치거나 기여하려는 사람을 위한 글입니다. 사용법은 [README](README.md)에 있습니다.

## 레포 구성

| 폴더 | 내용 |
|---|---|
| `app/` | Electron 앱. `src/core`(순수 로직), `src/adapters`(git, PTY, gh 등 바깥 세계), `src/main`(조립), `src/renderer`(화면) |
| `skills/` | 단계마다 에이전트가 따르는 절차의 원본. 앱이 task마다 조립해 시스템 프롬프트에 덧붙입니다(Codex는 스킬로 배포) |
| `docs/` | 설계(`design.md`), 구현 계획(`implementation.md`), 확인 기록(`checks.md`), 평가(`eval.md`) |
| `app/eval/` | 맨 Claude Code CLI와 견주는 사용성 평가 도구 |
| `spikes/` | 설계 전제를 확인한 탐색 코드(보관) |

## 개발 환경

Node.js 22, git, 로그인한 Claude Code가 필요합니다. `npm ci`가 node-pty(터미널용 네이티브 모듈)도 받습니다. Electron 바이너리는 앱을 처음 띄울 때 받습니다.

```bash
cd app
npm ci
npm run dev
```

## 확인

`app/`에서 돌립니다. PR CI(`app-ci`)가 같은 것을 Linux와 Windows에서 돕니다.

```bash
npm run typecheck && npm run lint && npm run format:check
npm test                                     # [단위], [어댑터], [흐름]
npm run test:contract                        # [계약] 가짜 쪽
npm run test:eval                            # 평가 도구 (평가 도구를 고쳤을 때)
RELAY_REAL_CLAUDE=dry npm run test:claude    # [실제] 시험 도구 (가짜 claude)
npm run build && npm run test:smoke          # [스모크] (화면을 고쳤을 때. Linux는 xvfb-run -a로)
cd ../skills && node check.mjs               # 스킬 정적 검사 (스킬을 고쳤을 때)
```

### 화면 찍기

화면을 고친 뒤 눈으로 확인할 때 씁니다. 에이전트도 사람에게 묻기 전에 이것으로 스스로 봅니다(`CLAUDE.md`).

```bash
npm run shot                                                                   # 첫 화면 → test-results/shot.png
npm run shot -- test-results/a.png --project                                   # sample 레포를 등록한 뒤
npm run shot -- test-results/a.png --project --steps test-results/steps.mjs    # 찍기 전에 steps.mjs의 default export (win, ctx)를 부른다
npm run shot -- test-results/a.png --scenario test-results/scenario.json       # 가짜 claude의 시나리오(test/support/scenarios.ts의 모양)
```

- [스모크]처럼 가짜 `claude`, 임시 `RELAY_HOME`과 userData, 같은 sample 레포로 띄웁니다. 실제 `claude`나 쓰던 relay를 건드리지 않고, relay를 켜 둔 채(relay 안의 세션에서도) 돕니다.
- 찍을 그림과 `steps.mjs` 같은 일회용 파일은 `test-results/`에 둡니다. git과 lint가 보지 않습니다. 상대 경로는 명령을 부른 폴더 기준입니다.
- `npm run shot`은 늘 빌드부터 합니다. 고친 것 없이 여러 장을 찍을 때는 `node scripts/shot.mjs ...`로 빌드를 건너뛰거나, `steps.mjs` 안에서 `win.screenshot({ path })`을 여러 번 부릅니다. `win`은 Playwright `Page`입니다.
- Linux에서 DISPLAY가 없으면(클라우드 세션 등) `xvfb-run`으로 돕니다. 시험 도구의 `.ts`를 바로 읽으므로 Node 22.18 이상이 필요합니다.

```js
// steps.mjs
export default async (win) => {
  await win.getByRole('button', { name: '새 Work' }).click()
  await win.getByLabel('요청').fill('빈 배열의 평균이 NaN이다')
}
```

시험의 층, 어느 층에 시험을 둘지, 실제 `claude`로 도는 [실제]와 [계약] 실제 쪽의 정기 실행은 [구현 계획 8장](docs/implementation.md)에 있습니다.

## 문서

- 설계를 바꾸는 결정은 `docs/design.md` 2절에 D 번호로, 구현의 결정은 `docs/implementation.md`에 I 번호로 적습니다.
- 사람이 돌리거나 확인한 것([실제], [계약] 실제 쪽의 수동 실행, [실기])은 `docs/checks.md`에 적습니다. CI 결과는 옮기지 않습니다.
- `README.md`는 사용자를 위한 글입니다. 개발 내용은 이 문서나 `docs/`에 둡니다.

## 릴리스

`v<버전>` 태그를 push하면 `app-release` 워크플로가 다음을 차례로 합니다:

1. Windows(NSIS `.exe`)와 Linux(`.deb`) 설치 파일을 빌드합니다. Linux는 ubuntu-22.04에서 빌드합니다.
2. 러너에 설치해 [스모크]를 통과하는지 봅니다. Linux는 ubuntu-22.04와 24.04에 각각 설치해 봅니다.
3. 모두 통과하면 GitHub Release를 만들어 설치 파일과 자동 업데이트 파일(`latest.yml`, `.blockmap`, `latest-linux.yml`)을 올립니다. 한쪽이라도 실패하면 Release를 만들지 않습니다.

버전은 태그에서 읽으므로 `package.json`은 고치지 않습니다([I95](docs/implementation.md)).

```bash
git tag v0.1.0
git push origin v0.1.0
```

- `v0.2.0-beta.1`처럼 `-`가 든 태그는 시험판(prerelease)으로 올라갑니다. 설치된 앱은 시험판을 자동으로 받지 않습니다.
- 버전은 이전 릴리스보다 커야 설치된 앱이 업데이트로 받습니다.
- 설치 파일만 확인하려면 수동 `app-build` 워크플로를 돌립니다(두 OS 모두). 그 결과물(버전 0.0.0)은 자동 업데이트하지 않습니다.
- 로컬에서 만들려면 Windows는 `npm run dist:win`, Linux는 `npm run dist:linux`입니다(결과물은 `app/dist/`).
