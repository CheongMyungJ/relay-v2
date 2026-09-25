# `fix` — 수정

## 목적

확정된 원인(또는 S 경로에서는 intent의 목표)에 맞게 코드를 고치고 커밋한다. 재현 테스트와 전체 테스트를 통과시킨다.

## 입력 (context.md)

intent, decisions, rejected-log, prev-handoff, `rca/rca.md?`, `evidence/evidence.md?`(path, 선택), repro-lock 조각(있으면), **gate-failure 조각**(g-tests 실패로 돌아온 경우: 실행한 검사, 종료 코드, 로그 끝부분), gate-policy, next-options.

## 결정 지점 (질문 예산: 최대 1개, 보통 0개)

| # | 결정 | `requires_human` | 언제 |
|---|---|---|---|
| 1 | rca의 수정 방향에서 벗어나야 하는가 (이유와 대안) | ✅ | 방향대로 고칠 수 없을 때만 |

S 경로에서 원인이 요청과 달라 보이면 묻지 말고 `recommended_next: rca`(또는 `evidence`)로 되돌린다. 이 전이가 규모 오분류의 탈출구다.

## 절차

1. 들어온 이유를 확인한다: 첫 실행인가, 게이트 실패로 돌아왔는가(gate-failure 조각). 실패로 돌아왔다면 실패 로그부터 분석하고, 이전 fix 시도 중 실패한 접근은 `rejected`에 적는다.
2. rca.md의 추천 방향대로 수정한다. S 경로(rca 없음)면 수정 전에 원인을 짧게 확인하고, 가능하면 **새 파일**로 회귀 테스트를 추가한다(고정되지는 않는다).
3. 검사를 직접 돌린다: 고정된 재현 테스트(`test_file`), 전체 테스트(`test`). 결과는 `self_checks`에 적는다(참고용).
4. 커밋한다: `relay(fix): <요약>`. 여러 커밋이어도 된다. 승인 요청 전에 `git status`가 깨끗해야 한다.
5. `fix.md`를 짧게 쓴다.
6. `_close`.

## 완료조건

- 고정된 재현 테스트가 통과한다(있으면). 재현 테스트 파일은 변경하지 않았다.
- 전체 테스트(`cmd:test`)가 통과한다. 통과하지 못하면 이유를 `risks`에 적고 수동 승인을 받는다.
- 기존 테스트 파일을 수정/삭제하지 않았다. 불가피했다면 파일과 이유를 `decisions`에 `requires_human: true`로 적는다(→ 자동 승인 금지).
- 모든 변경이 커밋되어 있다.

앱의 자동 승인 검사(bugfix 기본값): `repro:passes`, `repro:intact`, `tests:unchanged`, `cmd:test`, `tree:clean`, `diff:within_limit` + 공통 조건.

## 산출물 템플릿 — `fix.md`

```markdown
# 수정: <intent 제목>

## 변경 요약
- `src/auth/token.ts`: isExpired()를 epoch ms 비교로 변경

## 원인과의 대응
- rca.md "원인" → 위 변경으로 해소되는 이유 한두 문장

## 커밋
- <메시지 첫 줄들> (해시는 앱이 기록하므로 생략 가능)

## 테스트
- 추가한 테스트: 
- 기존 테스트 변경: 없음 | <파일과 이유>

## 남은 위험
- 
```

## handoff 확장

없음. 게이트 실패 후 재진입에서는 본문 "다음 task가 알아야 할 것"에 이번 시도에서 바꾼 점을 적는다.

## 하지 말 것

- 테스트를 약하게 고치거나(단언 제거, skip, 기대값을 실제값으로 바꾸기) 재현 테스트를 수정해서 통과시키지 않는다. 앱이 `repro:intact`와 `tests:unchanged`로 확인하고, final-verify가 다시 점검한다.
- intent의 비목표에 해당하는 리팩터링을 하지 않는다.
- push하지 않는다.

## relay.json

```json
{ "schema_version": 1, "name": "fix", "title": "수정",
  "summary": "원인에 맞게 코드를 고치고 커밋",
  "produces": [ { "path": "fix.md", "required": true,
                  "required_headings": ["변경 요약", "테스트"] } ],
  "handoff_extensions": [], "writes_code": true }
```
