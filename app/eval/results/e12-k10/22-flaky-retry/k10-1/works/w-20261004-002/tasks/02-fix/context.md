# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e12-k10/22-flaky-retry-k10-1/relay-home/projects/jobs-fa1fbf/works/w-20261004-002/tasks/02-fix
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: b7e3a70389ac5813165f58eb2d4f7b0d06c321e3

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

#### docs/knowledge/batch/nightly-batch-concurrency.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: rule
source: human
anchor: DEFAULTS
---
# 밤 배치는 동시 4개 병렬 실행을 유지한다

## 규칙
- 밤 배치의 기본 동시 실행 수는 4(`src/config.js`의 `DEFAULTS.concurrency`)로 유지한다. 순차 실행으로 되돌리거나 동시 수를 줄이면 밤 배치가 제시간에 끝나지 않는다.
- flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않는다. 진짜 원인을 코드에서 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/batch/pool-order-and-tmp-names.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
---
kind: pitfall
source: investigation
---
# 병렬 실행에서 순서와 임시 파일 이름을 가정하지 말 것

## 내용
- `runPool`(src/runner/pool.js)의 결과는 완료 순서가 아니라 items 순서여야 한다. `collectResults`가 인덱스로 job과 짝짓기 때문에, 지연 지터로 완료 순서가 바뀌면 report가 다른 job에 붙는다. 지연이 없는 로컬 `npm test`는 통과하고 지연을 쓰는 `npm run test:ci`에서만 간헐 실패한다.
- 임시 파일 이름을 ms 시각만으로 만들면 동시 저장끼리 겹친다(src/store/report-archive.js). 지금은 reportId를 함께 쓴다. 같은 reportId를 같은 ms에 동시 저장하면 여전히 겹칠 수 있다.

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
`npm run test:ci`의 `ci/archive.test.js`(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 간헐적으로 실패하는 문제를 없앤다. 실패는 `ENOENT: 파일이 없습니다: reports/2026-09/.<임시이름>.tmp`로 나타나고, 때로 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 함께 나온다. 재실행하면 통과한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패는 따로 고쳐 리뷰 중이므로 이번 범위가 아니다.
- 시험을 약화하거나 우회하지 않는다(재시도, skip, 시간 제한 늘리기).

## 원하는 결과
밤 배치를 조회와 저장 지연이 있는 CI 조건으로 몇 번을 반복해 돌려도 `ci/archive.test.js`가 늘 통과한다. 보고서는 저마다 제 고객사와 합계로 보관소에 남고, 임시 파일은 남지 않는다.

## 완료조건
- [ ] 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm test`도 통과한다
- [ ] `ci/archive.test.js`가 `ENOENT` 임시 파일 오류와 "보관본의 고객사가 다르다" 오류 없이 반복해서(예: 20회 연속) 통과한다

## 제약
- (팀 지식 `docs/knowledge/batch/nightly-batch-concurrency.md`) 밤 배치의 기본 동시 실행 수는 4(`src/config.js`의 `DEFAULTS.concurrency`)로 유지한다. 순차 실행으로 되돌리거나 동시 수를 줄이지 않는다.
- (팀 지식 `docs/knowledge/batch/nightly-batch-concurrency.md`) flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않고 진짜 원인을 코드에서 고친다.

## 추가 의견
- 없음
```

## Work 요청 원문

경로: /tmp/relay-eval/e12-k10/22-flaky-retry-k10-1/relay-home/projects/jobs-fa1fbf/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 12:05 (사람 승인)
- [사람] 범위는 ci/archive.test.js의 간헐 실패로 한정하고 ci/batch.test.js는 제외한다 — 요청에서 batch.test.js는 따로 고쳐 리뷰 중이라고 함
- [AI] 동시 4개 유지, 재시도/skip/시간 제한 늘리기 금지를 제약에 넣는다 — 팀 지식 nightly-batch-concurrency.md의 규칙
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js의 간헐 실패로 한정하고 ci/batch.test.js는 제외한다"
    why: "요청에서 batch.test.js는 따로 고쳐 리뷰 중이라고 함"
    by: human
  - what: "동시 4개 유지, 재시도/skip/시간 제한 늘리기 금지를 제약에 넣는다"
    why: "팀 지식 nightly-batch-concurrency.md의 규칙"
    by: ai
assumptions:
  - "재현은 지연을 쓰는 npm run test:ci를 반복 실행하는 것으로 본다. 로컬 npm test는 늘 통과한다고 했다"
  - "반복 통과 기준 20회는 임의로 정한 값이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 파일 두 개는 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 아직 없다. 앞 Work가 고친 코드(runPool 순서, 임시 파일 이름에 reportId 사용)도 이 브랜치에 없을 수 있다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패(임시 파일 ENOENT, 보관본 고객사 불일치)를 고치는 bugfix intent 초안을 썼다. 질문 없이 초안을 썼고 open_questions는 없다.
## 다음 task가 알아야 할 것
- 시험: `ci/archive.test.js`. 실행은 `npm run test:ci`, 로컬 `npm test`는 ci/ 시험을 돌리지 않는다.
- 참고(가설, 원인 확정 아님): `src/store/report-archive.js`의 `saveReport`가 임시 이름을 `.${stamp(now())}.tmp`로 만든다. 현재 브랜치 코드는 reportId를 쓰지 않고 시각만 쓰는 것으로 보인다.
- 팀 지식 참고 경로: `docs/knowledge/batch/pool-order-and-tmp-names.md` (runPool 결과 순서, 임시 파일 이름 겹침 유형)
- 제약 규칙은 `docs/knowledge/batch/nightly-batch-concurrency.md`
```

## 필요한 산출물

없음
