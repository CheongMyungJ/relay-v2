---
kind: fact
source: investigation
---
# Claude·Codex에 모델과 추론 수준을 넘기는 방법과 값의 출처

## 내용
- Claude Code: `--model <별칭>`, `--effort <low|medium|high|xhigh|max>`. `claude --help`와 계약 녹화본 `app/test/contract/fixtures/claude.json`(2.1.289)의 flags에 둘 다 있다. 앱은 시작과 `--resume` 모두 task 기록의 값으로 다시 준다.
- Codex: 설정 덮어쓰기 `-c model="<id>"`, `-c model_reasoning_effort="<수준>"`. Codex 계약 녹화본이 없어 [계약]이 보지 않는다.
- Codex 모델별 지원 추론 수준은 `~/.codex/models_cache.json`의 `supported_reasoning_levels`에 있다(공개 문서 없는 내부 파일). 앱은 읽지 않고 `AGENT_MODELS`로 옮겨 적는다(`docs/knowledge/agent/model-catalog.md` 참고). 2026-10-06 기준 gpt-6-luna, gpt-5.6-luna는 ultra가 없다.

## 바뀐 이력
- 2026-10-06 처음 남김 (Work w-20261006-001)
