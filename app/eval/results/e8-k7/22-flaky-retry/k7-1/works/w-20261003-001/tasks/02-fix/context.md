# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-1/relay-home/projects/jobs-b0f042/works/w-20261003-001/tasks/02-fix
- 작업 브랜치: relay/w-20261003-001
- 기준 브랜치: main
- 기준 커밋: 2b9d88e2adbb20508712eb9b284bb62600377d8d

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

없음

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.

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
CI 전용 시험 `ci/batch.test.js`(밤 배치를 실제와 비슷한 지연으로 실행)가 간헐적으로 실패하는 진짜 원인을 찾아 코드에서 고친다.

## 비목표
- 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 방식의 우회 (해결이 아님)
- 로컬 `npm test` 시험의 변경이나 무관한 기능 변경

## 원하는 결과
지연 타이밍과 관계없이 report가 항상 자기 job에 속한다. 즉 `expected report-N to belong to job-N, got job-(N-1)` 같은 불일치가 다시 나타나지 않는다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행해도 `ci/batch.test.js`)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/batch.test.js`에 재시도, skip, 시간 제한 증가가 추가되지 않는다
- [ ] 원인이 된 코드 경로를 고치고, 그 불일치를 잡는 시험이 있다

## 제약
- 간헐적 실패이므로 한 번 통과로 판단하지 않고 반복 실행으로 확인한다

## 추가 의견
- 실패 로그: `expected report-6 to belong to job-6, got job-5`. 재실행하면 통과한다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-1/relay-home/projects/jobs-b0f042/works/w-20261003-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 11:47 (사람 승인)
- [AI] 완료조건에 반복 실행 통과와 우회 금지 항목을 추가했다 — 간헐적 실패라 한 번 통과는 증거가 안 되고, 요청이 재시도/skip/시간 제한 증가를 해결이 아니라고 했다
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 반복 실행 통과와 우회 금지 항목을 추가했다"
    why: "간헐적 실패라 한 번 통과는 증거가 안 되고, 요청이 재시도/skip/시간 제한 증가를 해결이 아니라고 했다"
    by: ai
assumptions:
  - "원인은 프로덕션 코드의 경쟁 상태일 것으로 보지만 확인하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐적 실패라 재현에 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "시험에 재시도를 붙이거나 skip하는 것, 시간 제한을 늘리는 것은 해결이 아니다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패를 근본 원인부터 고치는 bugfix 의도를 정리했다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/)
- 관련 후보 위치(참고, 확인 안 함): `src/runner/pool.js`, `src/runner/runner.js`, `src/handlers/report.js`, `src/store/report-archive.js`, `src/util/jitter.js`
```

## 필요한 산출물

없음
