# relay-v2 개발 안내

이 레포에서 코드를 고치는 사람과 에이전트를 위한 짧은 안내다. 자세한 것은 `docs/implementation.md`(구현 계획, 8장이 시험)와
`docs/design.md`(설계)에 있다. `README.md`는 relay 사용자를 위한 글이므로 개발 안내를 넣지 않는다.

## 시험을 어느 층에 둘지

`docs/implementation.md` 8.1의 요약이다. 위에서부터 맞는 첫 층에 둔다.

1. 외부(`claude`, gh, OS) 없이 돌 수 있으면 [단위] `app/test/unit/`.
2. 실제 OS 자원(git, 파일, node-pty, 프로세스) 하나를 보면 [어댑터] `app/test/adapters/`.
3. 여러 모듈이 이어진 시나리오인데 화면이 필요 없으면 [흐름] `app/test/flow/` (가짜 `claude`·gh·codex).
4. 화면을 눌러야만 보이는 것만 [스모크] `app/test/smoke/`. [흐름]에서 본 로직을 화면에서 다시 보지 않는다.
5. 실제 모델 출력에 기대는 것: "깨졌나"는 [실제] `app/test/claude/`, "좋은가"는 평가 `app/eval/`. [실제]에 품질 판정을 넣지 않는다.
6. 한 동작은 가장 낮은 층에서 한 번만 자세히 보고, 위 층에서는 이어지는 것만 본다. 규칙의 경우를 [흐름]에서 하나씩 다시
   돌리지 않는다([흐름]은 세션을 띄워 느리다).

층들이 함께 쓰는 가짜와 시험 도구는 `app/test/support/`에 있다(가짜 `claude`·gh·codex, fixtures, harness, 시나리오).

## 바꾼 것에 따라 같이 할 일

- **앱이 훅 본문에서 새 필드를 읽거나, `claude`에 새 옵션을 넘기거나, gh JSON에서 새 필드를 읽으면** [계약]
  (`app/test/contract/claude.ts`, `gh.ts`)에 더한다. 실제에서 그 필드·옵션이 있는지는 녹화본(`fixtures/`)이 말한다.
  녹화본에 없으면 다시 녹화한다(8.2: `app-claude`의 경우 `contract`를 `update_contract`로 돌리거나, Claude Code 웹
  세션에서 `RELAY_CONTRACT_LIVE=1 RELAY_CONTRACT_UPDATE=1 npx vitest run --project contract test/contract/live.test.ts`).
- **가짜 `claude`·gh(`app/test/support/fake-*`)를 고치면** 실제 녹화본에 없는 필드를 지어내지 않는다. [계약] 가짜 쪽이 본다.
- **[실제] 시험(`app/test/claude/`)을 고치거나 더하면** 가짜 `claude`로 도는 dry도 통과하게 한다. dry의 가짜는 실제
  `claude`가 할 커밋과 산출물을 흉내 낸다.
- **평가 도구(`app/eval/`)의 판정·집계를 고치면** `app/eval/test/`에 시험을 더한다. 측정이 틀리면 평가의 결론이 뒤집힌다.
  시나리오를 더하거나 고치면 `node eval/check-scenario.mjs <id>`로 확인한다.
- **스킬(`skills/`)을 고치면** `cd skills && node check.mjs`.
- **계약 스키마(`docs/contracts/`)를 고치면** `npm run contracts`가 타입을 다시 만든다(`npm test`, `typecheck`, `build`도 먼저 돌린다).

## push 전에 돌릴 것

`app/`에서:

```bash
npm run typecheck && npm run lint && npm run format:check
npm test                                     # [단위], [어댑터], [흐름] (Linux에서 약 8분)
npm run test:contract                        # [계약] 가짜 쪽 (실제 쪽은 RELAY_CONTRACT_LIVE=1일 때만)
npm run test:eval                            # 평가 도구의 측정 로직과 시나리오 확인 (평가 도구를 고쳤을 때)
RELAY_REAL_CLAUDE=dry npm run test:claude    # [실제] 시험 도구 (가짜 claude, [실제]를 고쳤을 때)
npm run build && npm run test:smoke          # [스모크] 개발 빌드 (화면을 고쳤을 때. Linux는 xvfb-run -a로)
```

PR CI(`app-ci`)가 이것들을 Linux와 Windows에서 돈다. Windows에서만 깨지는 것(경로 대소문자, ConPTY)은 CI가 잡는다.
실제 `claude`와 gh를 부르는 [실제]와 [계약] 실제 쪽은 PR을 막지 않고 `app-claude`의 정기·수동 실행으로 돈다.

## 기록

- 사람이 돌리거나 확인한 것([실제], [계약] 실제 쪽의 수동 실행, [실기])만 `docs/checks.md`에 적는다. CI 결과는 옮기지 않는다.
- 설계를 바꾸는 결정은 `docs/design.md`의 D 번호, 구현의 결정은 `docs/implementation.md`의 I 번호로 적는다.
