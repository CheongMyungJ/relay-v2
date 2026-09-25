# relay 스킬 명세 (v1, 버그 수정 파이프라인)

이 디렉터리는 relay가 배포하는 스킬의 **명세**다. 실제 `SKILL.md`는 구현 단계에서 이 명세를 옮겨 쓴다.

| 스킬 | 파이프라인 노드 | 산출물 | 승인 (bugfix 기본값) | 명세 |
|---|---|---|---|---|
| `work-start` | intake | `intent.draft.md` | manual (g-intent와 합쳐 한 번 클릭, D37) | [work-start.md](work-start.md) |
| `evidence` | evidence | `evidence.md` + 재현 테스트 커밋 | auto_if_checks | [evidence.md](evidence.md) |
| `root-cause` | rca | `rca.md` | manual | [root-cause.md](root-cause.md) |
| `fix` | fix | 코드 커밋 + `fix.md` | auto_if_checks | [fix.md](fix.md) |
| `final-verify` | verify | `verification.md` (+ `pr.md`) | manual (g-done과 합쳐 한 번 클릭, D37) | [final-verify.md](final-verify.md) |
| `intent-revise` | (임시 노드) | `intent.draft.md` + `intent.diff.md` | manual (항상) | [intent-revise.md](intent-revise.md) |
| `_close` | (모든 스킬의 마지막 절차) | `handoff.md` | — | [_close.md](_close.md) |

v0.1의 `deliver` 스킬은 없앴다. push/PR은 앱이 `g-done`에서 결정론적으로 수행한다(design.md D19).

---

## 1. 배포와 이름

- 원본: `<RELAY_HOME>/skills/<name>/` (`SKILL.md`, `relay.json`, `templates/`)
- 세션 시작 전에 worktree의 `.claude/skills/relay-<name>/`으로 복사한다. **`relay-` 접두어**로 프로젝트 자체 스킬과 이름이 겹치지 않게 한다(D24). 복사한 경로는 `.git/info/exclude`에 넣는다.
- `_close`는 독립 스킬이 아니다. 모든 SKILL.md 끝에 같은 텍스트로 포함한다(빌드 시 삽입). 세션 재개 시 마무리용으로만 `relay-close` 스킬을 따로 둔다(design.md 8.3).
- `relay.json`(스키마: `contracts/skill-manifest.v1.schema.json`)은 앱이 검증에 쓴다. 에이전트는 읽지 않아도 된다.

## 2. 세션 시작 시 스킬이 받는 것

첫 프롬프트는 짧다(D18):

```
/relay-root-cause 이 task의 컨텍스트: C:\Users\me\.relay\projects\my-api-3f9a2c\works\w-20260925-001\tasks\04-rca\context.md
```

`context.md`(앱이 조립, 사람도 UI에서 볼 수 있음)의 구조:

```markdown
# relay task 컨텍스트
- work: w-20260925-001 / step: t-04 / node: rca / skill: root-cause
- RELAY_WORK_DIR: <절대 경로>        # intent.md, decisions.md 등
- RELAY_TASK_DIR: <절대 경로>        # 이 task의 산출물과 handoff.md를 쓸 곳
- worktree: <절대 경로> (브랜치 relay/w-20260925-001, base a1b2c3d)
- 검증 명령: <앱이 만든 명령 한 줄. 예: ELECTRON_RUN_AS_NODE=1 "C:\Program Files\relay\relay.exe" "<RELAY_HOME>\bin\relay-validate.js" handoff "<RELAY_TASK_DIR>\handoff.md">  # Node 미설치 환경 대응(D25). 스킬은 이 줄을 그대로 실행한다

## 승인 방식 (gate-policy)
## 이 task 이후 선택 가능한 다음 단계 (next-options)
## 의도 (intent@v1)
## 게이트 실패 정보 (있을 때만)
## 결정 로그 (decisions)
## 기각된 것들 (rejected-log)
## 직전 단계 인수인계 (prev-handoff)
## 이전 단계 요약 (handoff-chain)
## 필요할 때 읽을 파일 (path 조각 목록: 산출물, 이전 세션 기록 등)
```

## 3. 모든 스킬의 공통 규칙

### 3.1 골격

모든 명세는 같은 순서다: **목적 / 입력 / 결정 지점 / 절차 / 완료조건 / 산출물 템플릿 / handoff 확장 / 하지 말 것 / relay.json**.

### 3.2 질문 규칙 (질문 피로 대책, D46)

**역할 분담:** 터미널 대화는 **진행에 필요한 정보를 모으는 곳**, 앱의 승인 화면은 **확정하는 곳**이다. 사람이 결과를 확정하는 것은 승인 버튼이므로, 스킬이 같은 내용을 터미널에서 "이대로 확정할까요?"라고 다시 묻지 않는다.

1. **초안 먼저.** 컨텍스트와 코드로 추론할 수 있는 것은 채우고, 추론한 부분은 `assumptions`에 적는다. 사람은 승인 화면에서 초안과 가정을 함께 본다.
2. **없는 정보만 묻는다.** 에이전트가 알 수 없고 진행에 꼭 필요한 정보(재현 환경, 계정, 기대 동작이 불명확할 때 등)만 묻는다.
3. **질문 예산은 상한이다.** 명세의 결정 지점 표는 "물어도 되는 것"의 목록이자 최대치이며, 채울 의무가 없다. 질문 0개로 끝나는 것이 정상이다.
4. **물을 때는 한 번에.** 번호를 붙이고 각 질문에 추천안을 적어 "추천대로"로 답할 수 있게 한다.
5. **"알아서 해" 처리.** 사람이 위임하면 추천안을 택하고 `by: ai`로 기록한다. 결정 표에서 `requires_human`인 항목은 여전히 `requires_human: true`로 적는다 → 자동 승인이 막히고 승인 화면에서 사람이 본다.
6. `decisions`의 `by`는 에이전트의 보고일 뿐이다. 사람의 확정은 앱이 승인 기록으로 남긴다.
7. 에이전트의 세션 중 질문에 앱은 절대 자동으로 답하지 않는다(design.md 1.2).

### 3.3 파이프라인을 모른다 (D14)

- 스킬 본문에 다음 스킬 이름을 적지 않는다. 다음 단계는 context.md의 next-options에서 고른다.
- 산출물은 `RELAY_TASK_DIR`에만 쓴다. 다른 task 디렉터리는 읽기만 한다.
- `intent.md`, `decisions.md`, `work.json`, `events.jsonl`은 앱 소유다. 쓰지 않는다. 의도를 바꿔야 하면 handoff의 `intent_deviation`에 적는다.

### 3.4 정보 손실 대책 (task 사이 인수인계)

- handoff 본문 "다음 task가 알아야 할 것"에는 **파일 경로와 줄, 명령, 수치**처럼 다시 찾기 비싼 사실을 적는다. 감상이나 과정 서술은 적지 않는다.
- 시도했다가 버린 것은 반드시 `rejected`에 "무엇 + 왜"로 적는다. 앱이 이후 모든 task에 누적 주입한다.
- 근거가 긴 것(로그, 출력)은 산출물 파일에 두고 handoff에는 경로만 적는다.
- 다음 task는 필요하면 이전 세션 기록(`transcript` path 조각)을 직접 검색할 수 있다. 그래도 handoff만 읽고 시작할 수 있게 쓰는 것이 원칙이다.

### 3.5 git 규칙

- 코드를 바꾸는 스킬(evidence의 재현 테스트, fix)은 **승인 요청 전에 커밋한다**. 커밋 메시지 접두어: `relay(<node>): `.
- push, 브랜치 전환, rebase, reset, 다른 브랜치 병합은 하지 않는다. 전달은 앱이 한다.
- relay 파일(`.claude/skills/relay-*`, `.claude/settings.local.json`)은 커밋하지 않는다(exclude 처리됨).
