# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## 되감기로 들어옴 (먼저 읽을 것)

사람이 단계 선택으로 이 단계를 다시 실행한다(t-03 verify (리뷰와 검증)에서 고름). 폐기된 task의 산출물, 결정, 기각 목록은 아래 입력에서 뺐다. 사람 추가 지시를 따르고, 폐기된 시도를 그대로 되풀이하지 않는다.

### 사람 추가 지시

```text
서버 두 대가 원장을 따로 쓰는 경우도 한 통만 나가게 고쳐줘. 공용 원장을 주입할 수 있게 하고, 선점(claim)이 서버 간에도 원자적이어야 해. 두 인스턴스 동시 실행과 간격을 둔 실행 둘 다 테스트로 보여줘. 실패한 요약은 여전히 다시 보내야 해.
```

### 폐기된 시도 요약

- t-02 fix (원인 분석과 수정)
  - 요약: 요약 중복의 원인 두 가지(느린 성공을 시간 초과로 재시도, 키의 runId)를 고쳤다. 재현 테스트 3개 추가, `npm test` 77개 통과.
  - 기각: 일정(scheduler)의 중복 실행: lastPeriod로 한 프로세스에서는 막힘
- t-03 verify (리뷰와 검증)
  - 요약: 리뷰 지적 2건을 모두 반영(커밋 cf70c7f)했고 서버 두 대 테스트 4개를 더했다(커밋 82a5fb5). 원장을 공유하면 한 통이지만 원장을 따로 쓰는 경로는 실패(todo, 실제 2통)라 fix로 돌아가길 추천한다. `npm test` 82개 통과, todo 1. 고친 지식: docs/knowledge/delivery/digest-key-includes-run-id.md — pitfall에서 rule로 바꾸고 runId 제외와 claim/release 규칙을 적음 고친 지식: docs/knowledge/delivery/slow-success-is-not-timeout.md — 느린 실패도 재시도한다는 점과 요약 테스트 위치 추가
  - 기각: 없음
  - 이전 단계 추천: fix (원인 분석과 수정) — 서버 두 대가 원장을 따로 쓰면 이번 수정으로 막히지 않음(todo 테스트 actual 2). 공용 원장 주입과 저장소 쪽 원자적 선점을 고쳐야 함

### 코드

[현재 코드 위에서 이어서]: 폐기된 시도의 커밋이 남아 있다. 그 위에서 이어서 고친다.

폐기된 시도의 산출물 (참고, 입력이 아니다):

- t-02 fix (원인 분석과 수정): /tmp/relay-eval/e12-k10/23-double-notify-digest-k10-5/relay-home/projects/notify-bae4ff/works/w-20261004-002/tasks/02-fix/fix.md
- t-03 verify (리뷰와 검증): /tmp/relay-eval/e12-k10/23-double-notify-digest-k10-5/relay-home/projects/notify-bae4ff/works/w-20261004-002/tasks/03-verify/pr.md
- t-03 verify (리뷰와 검증): /tmp/relay-eval/e12-k10/23-double-notify-digest-k10-5/relay-home/projects/notify-bae4ff/works/w-20261004-002/tasks/03-verify/verification.md

## task 정보

- work_id: w-20261004-002
- task_id: t-04
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e12-k10/23-double-notify-digest-k10-5/relay-home/projects/notify-bae4ff/works/w-20261004-002/tasks/04-fix
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: 4fe181ba62336abd7bb4b009572845b07bb3040e

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. "범위에서 뺌"이라고 적혀 있어도 금지가 아니라 그때 Work의 범위였다. 이번 요청이 그 코드를 고치는 일이면 규칙대로 고친다. `## 아직 정하지 않은 것`은 규칙이 아니다. 이번 일이 그 사항에 걸리면 지금 코드의 상태를 근거로 삼지 말고 사람에게 묻는다. 그 절들이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/delivery/digest-key-includes-run-id.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
anchor: digestKey
---
# 요약 원장 키(digestKey)에 runId가 들어 있어 다른 runId로 다시 돌리면 중복 방지가 듣지 않는다

## 내용
- `src/digest/key.js`의 키에 runId가 포함된다. 같은 기간의 요약을 재시작이나 서버 여러 대로 다른 runId에서 다시 돌리면 원장(`ledger.markSent`)이 막지 못해 요약이 중복될 수 있다.
- Work w-20261004-001에서 발견했으나 이번 증상(느린 성공)과 무관해 고치지 않았다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/delivery/slow-success-is-not-timeout.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
---
# 느리게 성공한 발송을 시간 초과로 보고 재시도하면 중복 발송이 된다

## 내용
- 어댑터가 성공(`outcome.ok`)을 돌려줬으면 걸린 시간과 상관없이 끝난 발송이다. 다시 보내면 같은 알림을 두 번, 재시도 횟수만큼 세 번까지 받는다.
- 메일은 SMTP 중계라 푸시보다 지연이 커서 더 자주 걸린다(fake 기본 지연 메일 400ms, 푸시 80ms).
- 일반 발송은 `src/retry/policy.js` `decide()`에서 `outcome.ok`를 시간 초과 검사보다 먼저 본다. 요약은 `src/digest/deadline.js` `withDeadline()`이 던지지 않고 `slow: true`로 알리고 `runner.js`가 `digest.send.slow` 지표를 올린다.
- 실패한 발송의 시간 초과 재시도는 일부러 유지한다. 새 재시도 경로를 만들 때도 성공 여부를 먼저 본다.
- 테스트: `test/duplicate-send.test.js`

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.
- 사람의 지금 말이 위 항목과 어긋나면(값이나 규칙이 바뀌었으면) "고칠 지식: <경로> — <새 내용> (사람)"으로 후보에 적는다. verify가 그 항목을 고친다.
- 사람이 이번 Work의 범위로 한 말("이번엔 손대지 마라", "다음에 따로 고친다", "이번 범위가 아니다")은 규칙이 아니다. "~는 수정하지 않는다" 같은 규칙으로 남기지 않는다. 사람이 "앞으로도 늘"처럼 오래 지킬 것으로 말했을 때만 규칙이다. 후보에는 "아직 규칙을 따르지 않음: <경로> — <지금 상태>, 사람이 이번 범위에서 뺌 (사람)"으로 적는다.
- 사람이 "따로 정한다", "아직 모른다", "이번 범위가 아니다"라고 한 미정 사항(예: 새 값을 어디까지 적용할지)은 규칙이 아니다. 코드에서 그 사항을 한쪽으로 임시로 정해 두었어도(예: 옛 값을 상수로 남김) 규칙으로 적지 않는다. 후보에는 "정하지 않음: <무엇> — <누가 언제 정하나>, 지금 코드는 <상태> (사람)"으로 적는다.

## 선택 가능한 다음 단계

- 기본 다음 단계: verify (리뷰와 검증)
- 이전 단계: intake (의도 정리)

## intent (버전 1)

```markdown
---
schema_version: 1
version: 1
type: bugfix
---
## 목표
아침 요약 메일(전날 알림 모음)이 같은 날 두 통, 가끔 세 통 발송되는 버그의 원인을 찾아 고친다.

## 비목표
- 요약 외의 일반 알림 발송 로직 변경
- 요약 발송 시각·내용 형식 변경

## 원하는 결과
같은 날짜의 요약은 수신자에게 정확히 한 번만 발송된다. 실제로 발송되지 못한 요약은 이후 재시도로 다시 보내지며, 요약이 건너뛰어지는 일은 없다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 같은 기간의 요약을 두 번 이상 실행해도 수신자당 한 통만 발송됨을 보이는 테스트가 있다
- [ ] 발송에 실패한 요약은 다시 시도되어 결국 발송됨을 보이는 테스트가 있다

## 제약
- 중복을 없애려고 요약을 건너뛰게 만들면 안 된다(실제 미발송 건은 재발송 필요).

## 추가 의견
- 없음
```

## Work 요청 원문

경로: /tmp/relay-eval/e12-k10/23-double-notify-digest-k10-5/relay-home/projects/notify-bae4ff/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 13:51 (사람 승인)
없음
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "요약 발송 코드는 src/digest/ 아래에 있다고 보고, 재현 절차는 fix에서 정한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목 두 개는 기준 브랜치(docs/knowledge/)에 아직 없다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그의 intent 초안을 썼다. 목표는 같은 날 요약 1회 발송이고, 미발송 건은 재발송하며 건너뛰지 않는다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 요약 코드: `src/digest/` (key.js, ledger.js, runner.js, deadline.js, scheduler.js)
- 참고용 팀 지식(조사 결과이며 이번 원인이라는 근거 아님, 기준 브랜치에는 아직 없음): `docs/knowledge/delivery/digest-key-includes-run-id.md`, `docs/knowledge/delivery/slow-success-is-not-timeout.md`
```

## 필요한 산출물

없음
