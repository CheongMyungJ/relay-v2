# 계약 (contracts, v1)

앱, 스킬, 향후 확장(지식 추출, 게이트 추가, 다른 벤더)이 공유하는 형식이다. 모든 스키마는 JSON Schema **draft 2020-12**이며, 구현에서는 ajv로 같은 파일을 그대로 쓴다(이 디렉터리가 단일 원천).

| 파일 | 대상 | 쓰는 쪽 | 읽는 쪽 |
|---|---|---|---|
| `handoff.v1.schema.json` | `tasks/<nn>-<node>/handoff.md`의 YAML 머리글 | 에이전트(`_close`) | 앱, 다음 task |
| `intent.v1.schema.json` | `intent.md`, `intent.draft.md` 머리글 + 본문 규칙(`x-relay-body`) | 에이전트(초안), 앱(확정) | 앱, 모든 task |
| `pipeline.v1.schema.json` | `<RELAY_HOME>/pipelines/*.yaml`, `works/<id>/pipeline.yaml` | 사람(템플릿 작성) | 앱 |
| `work.v1.schema.json` | `works/<id>/work.json` | 앱만 | 앱, UI |
| `event.v1.schema.json` | `works/<id>/events.jsonl` 한 줄 | 앱만 | 이벤트 구독자 |
| `project.v1.schema.json` | `projects/<id>/project.json` | 앱(등록 화면) | 앱 |
| `config.v1.schema.json` | `<RELAY_HOME>/config.json` | 사람(설정 화면) | 앱 |
| `context-manifest.v1.schema.json` | `tasks/<nn>/context.manifest.json` | 앱 | UI, S6 분석 |
| `skill-manifest.v1.schema.json` | `skills/<name>/relay.json` | 스킬 작성자 | 앱 |
| `hook-ipc.v1.schema.json` | 훅 스크립트 ↔ 앱 메시지 | relay-hook.js, 앱 | 같음 |
| `state-machine.md` | 파이프라인 상태 기계 규칙(표와 의사 코드) | — | 앱(PipelineEngine), 테스트 |
| `examples/` | 유효한 예시(bugfix 파이프라인, project.json, intent, handoff) | — | 문서, 계약 테스트 fixture |

## 공통 규칙

- **인코딩:** UTF-8(BOM 허용, 읽을 때 제거), 줄바꿈 LF/CRLF 모두 허용. 앱이 쓰는 파일은 LF.
- **front matter:** 파일 첫 줄이 `---`, 다음 `---`까지가 YAML. YAML 1.2 core 스키마로 파싱하고 날짜·시각은 문자열로 둔다(`on`/`yes`가 불리언이 되는 YAML 1.1 동작 금지).
- **경로:** 산출물 경로는 task 디렉터리 기준 상대 경로. 절대 경로, 드라이브 문자, `..` 금지(`handoff.v1`의 `relpath`).
- **id 형식:** work `w-YYYYMMDD-NNN`, step/task `t-NN`, 노드 `^[a-z][a-z0-9-]{0,31}$`, 임시 노드 `x-<skill>`.
- **시각:** RFC 3339, 로컬 오프셋 포함(`2026-09-25T10:42:00+09:00`).
- **스키마 밖 규칙:** JSON Schema로 표현하기 어려운 검사(참조 무결성, 본문 절, 스킬 산출물 존재)는 `state-machine.md` 1절(P1~P9)과 각 스키마의 `description`/`x-relay-*`에 적고 앱의 Validators가 수행한다.

## 버전 규칙

- 각 문서는 `schema_version` 필드를 가진다(이벤트는 줄마다).
- **호환 변경**(선택 필드 추가, 새 이벤트 타입, enum 값 추가 중 읽는 쪽이 무시할 수 있는 것): 같은 버전 안에서 스키마 파일만 갱신한다.
- **비호환 변경**(필드 삭제·이름 변경·의미 변경, 필수 필드 추가): `schema_version`을 올리고 파일을 `*.v2.schema.json`으로 새로 만든다. 앱은 이전 버전 파일을 읽을 수 있어야 한다(`work.json`은 시작 시 마이그레이션, handoff는 이전 task의 것이므로 읽기만).
- 스킬 SKILL.md의 handoff 템플릿은 handoff 스키마 버전을 명시한다. 스킬과 앱의 버전이 어긋나면 세션 시작 전에 앱이 경고한다.

## 예시 검증

`examples/`의 파일은 각 스키마로 검증된 상태를 유지한다(architecture.md 5절의 계약 테스트). 스킬 명세(`docs/skills/*.md`)의 `relay.json` 블록도 `skill-manifest.v1`로 검증한다.
