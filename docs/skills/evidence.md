# `evidence` — 재현과 증거 수집

## 목적

버그를 **재현**하고, 가능하면 **실패하는 자동 테스트**로 고정할 수 있게 만든다. 원인 분석에 쓸 관찰 사실을 모은다.

## 입력 (context.md)

intent(inline), decisions, rejected-log, prev-handoff(work-start), project-profile(특히 `test_file` 명령 유무), gate-policy, next-options.

## 결정 지점 (질문 예산: 최대 2개)

| # | 결정 | `requires_human` | 언제 |
|---|---|---|---|
| 1 | 재현 조건 확인: 환경, 데이터, 계정 등 에이전트가 알 수 없는 것 | — | 재현에 필요한 정보가 없을 때만 |
| 2 | 자동 테스트로 재현할 수 없을 때 수동 재현으로 진행해도 되는가 | ✅ | 자동 재현 실패 시에만 |

재현에 성공하면 질문 없이 끝날 수 있다. 이 스킬은 자동 승인 대상이라 질문이 적을수록 좋다.

## 절차

1. intent의 목표와 요청 원문에서 기대 동작/실제 동작을 한 줄씩 정리한다.
2. 재현을 시도한다. 우선순위:
   1. 기존 테스트 체계 안에 **새 테스트 파일**로 재현 (`test_globs`에 걸리는 새 파일. 기존 테스트 파일 수정 금지)
   2. 스크립트나 명령으로 재현
   3. 수동 절차로 재현 (사람의 확인 필요)
3. 자동 테스트로 재현했다면:
   - `project.checks.test_file` 명령으로 그 파일만 실행해 **실패하는지** 직접 확인한다.
   - 실패 이유가 버그 자체인지 확인한다(import 오류, 문법 오류, 픽스처 누락으로 실패하면 안 된다).
   - 테스트 파일만 커밋한다: `relay(evidence): add failing repro test for <요약>`.
4. 관찰 사실(로그, 입력값, 출력값, 환경)을 `evidence.md`에 기록한다. 추측은 "가설 후보" 절에만 쓴다.
5. 재현하지 못하면 시도한 방법을 모두 `rejected`에 적고, `status: blocked`(정보 부족) 또는 수동 재현으로 진행할지 묻는다.
6. `_close`.

## 완료조건

- 재현 성공 여부가 명시되어 있다(성공/부분/실패).
- 성공했다면 재현 절차 또는 재현 테스트가 있고, 재현 테스트라면 커밋되어 있으며 `test_file`로 실패한다.
- 실패했다면 시도한 방법과 부족한 정보가 기록되어 있다.

## 앱이 이어서 하는 일 (참고)

handoff의 `extensions.repro.kind: test`를 보고 앱이 테스트를 다시 실행해 실패를 확인하고 파일 해시를 고정한다(state-machine.md 4.1). 고정이 되면 이후 fix는 이 테스트가 통과해야 자동 승인되고, 파일이 바뀌면 사람이 원복·재고정·해제 중에서 고른다. 고정한 evidence 다음에는 항상 rca(사람 검토)가 온다. `test_file` 명령이 없는 프로젝트는 고정하지 않으며 이 task는 수동 승인이 된다.

## 산출물 템플릿 — `evidence.md`

```markdown
# 증거: <intent 제목>

## 기대 동작과 실제 동작
- 기대: 
- 실제: 

## 재현 결과
성공 | 부분 | 실패

## 재현 방법
- 종류: 자동 테스트 | 스크립트 | 수동
- 파일/명령: `tests/auth/expiry.test.ts` / `npx vitest run tests/auth/expiry.test.ts`
- 실패 출력 (끝부분):
  ```
  ```

## 관찰 사실
- (환경, 입력, 로그 인용. 출처 경로 포함)

## 가설 후보 (검증 안 됨)
- 

## 재현하지 못한 시도
- 
```

## handoff 확장

```yaml
artifacts: [evidence.md]
extensions:
  repro:
    kind: test                      # test | manual | none
    file: tests/auth/expiry.test.ts # kind: test일 때 필수, worktree 기준
    test_name: "expires tokens with server TZ offset"
```

## 하지 말 것

- 기존 테스트 파일을 고치지 않는다. 기존 테스트에 재현 케이스를 추가하고 싶어도 새 파일로 만든다(고정과 `tests:unchanged`를 단순하게 유지).
- 제품 코드를 고치지 않는다. 디버그 출력을 넣었다면 커밋하지 않고 되돌린다.

## relay.json

```json
{ "schema_version": 1, "name": "evidence", "title": "재현과 증거",
  "summary": "버그를 재현하고 실패하는 테스트로 고정",
  "produces": [ { "path": "evidence.md", "required": true,
                  "required_headings": ["기대 동작과 실제 동작", "재현 결과", "재현 방법", "관찰 사실"] } ],
  "handoff_extensions": [ { "name": "repro", "schema": "https://relay.local/schemas/handoff.v1.json#/$defs/ext_repro" } ],
  "capabilities": ["repro_lock"], "writes_code": true }
```
