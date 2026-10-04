# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/23-double-notify-digest-k7-5/relay-home/projects/notify-bac53e/works/w-20261003-002/tasks/03-verify
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: fb599332e1227dac6ed40a9cc5b9cbb3aac5891d

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/digest-key-excludes-run-id.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 요약 중복 방지 키에는 runId를 넣지 않는다

- 종류: 실패 유형
- 적용: src/digest/key.js, src/digest/runner.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

요약의 보낸 키는 `digest:기간:사용자`다. runId를 넣으면 같은 기간을 재시작·수동 재실행할 때 키가 달라 이미 보낸 요약을 또 보낸다.
실행별 집계는 키가 아니라 발송 기록(ledger entry)의 runId 필드로 한다(`runSummary(runId)`).
키 형식을 바꾸면 배포 직후 옛 키(runId 포함)는 인식되지 않아 그 기간은 한 번 더 갈 수 있다.
```

#### docs/knowledge/successful-send-never-retried-on-slow.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 성공한 발송은 느렸어도 재시도하지 않는다

- 종류: 규칙
- 적용: src/retry/policy.js, src/digest/deadline.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

발송이 성공(`outcome.ok`)이면 걸린 시간이 제한을 넘어도 이미 전달된 것이므로 재시도하지 않는다. 다시 보내면 고객에게 중복 알림이 간다(메일 3000ms/제한 2000ms 성공 건이 재시도 때 또 발송된 사례).
시간 초과가 재시도 사유가 되는 것은 어댑터가 시간 초과 오류(`SendTimeoutError`)를 던져 실제로 실패했을 때뿐이다.
요약 발송도 같다. 느린 성공은 오류로 바꾸지 않고 `slow`로만 알린다.
```

### 지식 남기기 (이 단계에서 할 일)

공통 종료 절차의 커밋 전에, 이 Work에서 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에 남기고 코드와 함께 커밋한다. 팀이 PR로 함께 보고, 다음 일의 에이전트가 읽는다. 재료는 아래 지식 후보, Work 요청 원문(`request.md`), intent의 `비목표`와 `제약`, 결정 로그의 사람 결정(`by: human`), 이 task에서 사람이 한 말이다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.
- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.
- 규칙과 사실, 그 까닭을 쓴다. 코드의 지금 모양(어느 함수가 무엇을 쓰는지)은 이 Work가 바꿨을 수 있고 기준 브랜치에는 아직 없을 수 있으니 "관련 위치"로만 적고 "이렇게 되어 있다"고 쓰지 않는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다(다음 일이 같은 것을 다시 묻게 만든다).
- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다.
- 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다. 규칙이 여럿이면(예: 계산 규칙과 적용 순서) 항목을 나눈다.
- 한 항목에 파일 하나. 파일 이름은 내용을 나타내는 영어 소문자와 `-` (예: `no-cache-external-api.md`). 같은 내용의 파일이 이미 있으면 새로 만들지 말고 그 파일을 고친다.
- 무엇이 맞고 무엇이 틀린지, 예와 수치를 적는다. 다음 사람이 이 파일만 읽고 따를 수 있어야 한다.
- 위 항목 가운데 "기준 브랜치에는 아직 없다"고 적힌 것은 이 worktree에 파일이 없다. 그 항목을 고쳐야 할 때만 같은 경로에 앞 내용을 모두 살려 고친 파일을 쓰고(머지하면 이 Work의 파일이 남는다), 고칠 것이 없으면 그 파일을 만들지 않는다.
- 남긴 파일은 handoff의 `## 요약` 끝에 "남긴 지식: <경로>"로 적는다. 남길 것이 없으면 "남긴 지식: 없음 (까닭)"으로 적는다. 앱이 이 줄을 확인한다.

파일 형식:

```markdown
# <한 줄 제목: 규칙이나 사실>

- 종류: 규칙 | 사실 | 이력 | 실패 유형
- 적용: <관련 경로나 영역>
- 출처: <사람이 알려 줌 / 조사로 알아냄>, relay Work w-20261003-002, 2026-10-03

<본문: 5줄 안팎>
```

#### 앞 task들의 지식 후보

- t-02 fix: 요약 스케줄러는 실행이 끝난 뒤에만 기간을 보낸 것으로 기록하고, inbox에 남은 이전 기간도 따라잡는다(src/digest/scheduler.js)

## 선택 가능한 다음 단계

- 기본 다음 단계: Work 완료
- 이전 단계: intake (의도 정리), fix (원인 분석과 수정)

## intent (버전 1)

```markdown
---
schema_version: 1
version: 1
type: bugfix
---
## 목표
아침 요약 메일(전날 알림 모음)이 같은 날 두 통, 세 통씩 중복 발송되는 버그의 원인을 찾아 고친다.

## 비목표
- 요약 메일의 내용·형식·발송 시각 변경
- 일반 알림(요약 아닌 것)의 발송 로직 변경 (요약 중복의 원인이 공유 코드에 있을 때만 해당 부분을 건드린다)

## 원하는 결과
- 사용자 한 명이 같은 기간(전날)의 요약을 하루에 한 통만 받는다.
- 실제로 발송에 실패한 요약은 다시 보낸다.
- 어떤 경우에도 요약이 하루 통째로 건너뛰어지지 않는다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 같은 기간·사용자의 요약은 재시작이나 재실행을 거쳐도 한 번만 발송된다는 테스트가 있다
- [ ] 발송이 실패한 요약은 재시도되어 결국 발송된다는 테스트가 있다
- [ ] 요약이 하루 건너뛰어지지 않는다는 테스트가 있다

## 제약
- (팀 지식 docs/knowledge/successful-send-never-retried-on-slow.md) 발송이 성공(`outcome.ok`)이면 느렸어도 재시도하지 않는다. 시간 초과가 재시도 사유가 되는 것은 어댑터가 `SendTimeoutError`를 던져 실제로 실패했을 때뿐이다. 요약 발송도 같고, 느린 성공은 오류로 바꾸지 않고 `slow`로만 알린다.

## 추가 의견
- 없음
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/23-double-notify-digest-k7-5/relay-home/projects/notify-bac53e/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 13:31 (사람 승인)
- [AI] 완료조건에 중복 방지, 실패 건 재발송, 하루 누락 방지 테스트 항목을 추가한다 — 요청의 요구: 못 보낸 요약은 다시 보내고, 하루 건너뛰면 안 된다
- [AI] 느린 성공은 재시도하지 않는다는 팀 규칙을 제약에 옮겼다 — 요약 발송에도 적용되는 규칙(팀 지식)

## t-02 fix — 2026-10-03 13:33 (자동 승인)
- [AI] 요약 키에서 runId를 뺐다 — docs/knowledge/digest-key-excludes-run-id.md: 실행별 집계는 ledger entry의 runId 필드로 한다
- [AI] 느린 성공은 오류로 바꾸지 않고 slow로만 알린다 — docs/knowledge/successful-send-never-retried-on-slow.md와 intent 제약
- [AI] 스케줄러가 성공 후에만 기간을 done으로 치고, inbox에 남은 놓친 기간도 보낸다 — 완료조건: 요약이 하루 건너뛰어지지 않는다
```

## 누적 기각 목록

- t-02 fix: retry/policy.js decide()의 같은 패턴: 일반 알림 전용이라 비목표, 요약은 쓰지 않음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 키에서 runId를 뺐다"
    why: "docs/knowledge/digest-key-excludes-run-id.md: 실행별 집계는 ledger entry의 runId 필드로 한다"
    by: ai
  - what: "느린 성공은 오류로 바꾸지 않고 slow로만 알린다"
    why: "docs/knowledge/successful-send-never-retried-on-slow.md와 intent 제약"
    by: ai
  - what: "스케줄러가 성공 후에만 기간을 done으로 치고, inbox에 남은 놓친 기간도 보낸다"
    why: "완료조건: 요약이 하루 건너뛰어지지 않는다"
    by: ai
assumptions:
  - "서버가 꺼져 있던 날의 요약도 inbox에 알림이 남아 있으면(keepDays 2일 안) 보내야 한다고 봤다"
rejected:
  - "retry/policy.js decide()의 같은 패턴: 일반 알림 전용이라 비목표, 요약은 쓰지 않음"
open_questions: []
intent_deviation: null
risks:
  - "키 형식 변경 직후 옛 키(runId 포함)는 인식되지 않아 배포 직후 그 기간은 한 번 더 갈 수 있음"
  - "decide()(src/retry/policy.js)는 일반 알림에서 느린 성공을 timeout으로 재시도하는 같은 문제가 남아 있음(비목표라 미수정, 앞 Work w-20261003-001에서 고쳤을 수 있음, 머지 대기)"
  - "run이 끝까지 가서 failed로 포기한 사용자는 같은 프로세스의 다음 tick에서 자동 재시도되지 않고 수동 run으로만 재발송됨"
recommended_next: null
knowledge_candidates:
  - "요약 스케줄러는 실행이 끝난 뒤에만 기간을 보낸 것으로 기록하고, inbox에 남은 이전 기간도 따라잡는다(src/digest/scheduler.js)"
---
## 요약
요약 중복의 원인 셋(runId 포함 키, 느린 성공을 오류로 바꿔 재시도, 실행 전 lastPeriod 기록·어제만 보는 일정)을 고치고 테스트 6개를 추가했다. `npm test` 80개 통과.
## 다음 task가 알아야 할 것
- 키: `src/digest/key.js`, 느린 성공: `deadline.js`의 `slow`, 러너 `summary.slow`
- 일정: `src/digest/scheduler.js`의 `done` 집합과 catch-up 반복
- 테스트: `test/digest.test.js` 끝 6개, 명령 `npm test`
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e8-k7/23-double-notify-digest-k7-5/relay-home/projects/notify-bac53e/works/w-20261003-002/tasks/02-fix/fix.md
