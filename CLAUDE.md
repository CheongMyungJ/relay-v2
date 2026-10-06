# relay-v2

명령과 절차는 `CONTRIBUTING.md`, 시험 전략은 `docs/implementation.md` 8장. `README.md`는 사용자용이라 개발 내용을 넣지 않는다.

## 시험을 둘 층 (맞는 첫 층)

1. 외부(`claude`, gh, OS) 없이 되면 [단위] `app/test/unit/`
2. 실제 OS 자원(git, 파일, PTY, 프로세스)을 보면 [어댑터] `app/test/adapters/`
3. 여러 모듈의 시나리오면 [흐름] `app/test/flow/` (가짜 `claude`·gh, 느리다)
4. 화면을 눌러야만 보이면 [스모크] `app/test/smoke/`
5. 실제 모델이 필요하면 [실제] `app/test/claude/` (깨졌나만 본다. 품질은 평가 `app/eval/`)

한 동작은 가장 낮은 층에서 한 번만 자세히 보고 위 층은 이어지는 것만 본다. 공용 가짜와 도구는 `app/test/support/`.

## 같이 할 일

- 훅 본문의 새 필드, `claude`의 새 옵션, gh JSON의 새 필드를 쓰면 `app/test/contract/`의 계약에 더하고 녹화본(`fixtures/`)에 있는지 본다(없으면 다시 녹화, 8.2).
- 가짜 `claude`·gh를 고칠 때 녹화본에 없는 필드를 지어내지 않는다.
- [실제] 시험을 고치면 `RELAY_REAL_CLAUDE=dry`도 통과하게 한다. 평가 도구의 판정·집계를 고치면 `app/eval/test/`에 시험을 더한다.

push 전 (`app/`): `npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:contract`
