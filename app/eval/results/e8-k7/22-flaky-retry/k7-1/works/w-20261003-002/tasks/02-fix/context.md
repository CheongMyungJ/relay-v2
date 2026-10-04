# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-1/relay-home/projects/jobs-b0f042/works/w-20261003-002/tasks/02-fix
- 작업 브랜치: relay/w-20261003-002
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
CI의 `npm run test:ci`에서 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 가끔 실패하는 문제를 고친다. 로컬 `npm test`는 늘 통과하고, CI에서는 재실행하면 통과한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐 리뷰 중이므로 건드리지 않는다.
- 재시도, 재실행, 시험 건너뛰기, 대기 시간 늘리기로 실패를 가리는 것은 해결로 보지 않는다.

## 원하는 결과
`ci/archive.test.js`가 반복 실행해도 안정적으로 통과한다. 실패 증상(`ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`)이 다시 나타나지 않는다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `ci/archive.test.js`를 여러 번(예: 20회) 연속 실행해도 모두 통과한다
- [ ] 위 두 가지 실패 메시지가 반복 실행 중 한 번도 나오지 않는다

## 제약
- 시험 쪽만 손봐서 통과시키지 않고, 실패가 생기는 근본 원인을 고친다.

## 추가 의견
- 실패 로그는 실행마다 다르다. 임시 파일 이름(`.mups96qp.tmp`)이 매번 바뀌는 점은 요청에 적힌 관찰이다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-1/relay-home/projects/jobs-b0f042/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 11:52 (사람 승인)
- [사람] 범위는 ci/archive.test.js의 간헐 실패로 한정하고 batch.test.js는 제외 — 요청에 batch.test.js는 따로 리뷰 중이라 범위가 아니라고 적혀 있음
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js의 간헐 실패로 한정하고 batch.test.js는 제외"
    why: "요청에 batch.test.js는 따로 리뷰 중이라 범위가 아니라고 적혀 있음"
    by: human
assumptions:
  - "반복 실행 횟수 20회는 임의 기준이며 승인 때 조정 가능"
  - "시험만 고쳐 가리는 것은 해결이 아니라고 보고 제약에 적음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한두 번 통과로는 해결을 확신할 수 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패를 고치는 bugfix intent 초안을 썼다. 원인은 조사하지 않았다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm run test:ci` (`node --test "test/**/*.test.js" "ci/**/*.test.js"`), 로컬은 `npm test`
- 대상: `ci/archive.test.js`(42줄), 제외: `ci/batch.test.js`
- 팀 지식 항목 없음
```

## 필요한 산출물

없음
