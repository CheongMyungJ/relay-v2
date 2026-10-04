# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-3/relay-home/projects/jobs-676026/works/w-20261003-002/tasks/03-verify
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 0705ba4fccfd21b51288c86bc087591fdeebfcae

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

#### docs/knowledge/keep-parallel-concurrency.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 병렬 실행(동시 4개)을 줄이거나 순차로 되돌리는 것은 간헐 실패의 해결이 아니다

- 종류: 규칙
- 적용: src/runner/pool.js, src/nightly.js
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패가 동시성에서 드러나도 동시성(4개)을 낮추거나 순차로 되돌려 가리지 않는다. 동시 실행에서도 맞게 동작하도록 코드를 고친다.
```

#### docs/knowledge/no-retry-skip-for-flaky-tests.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 간헐적으로 실패하는 시험은 재시도·skip·시간 제한 증가로 풀지 않고 코드에서 원인을 고친다

- 종류: 규칙
- 적용: ci/, test/ 전체
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

시험이 가끔 실패하면 재시도를 붙이거나, skip하거나, 시간 제한을 늘리는 것은 해결이 아니다. 지연(타이밍)에 따라 드러나는 원인을 src/에서 찾아 고친다.
예: `ci/batch.test.js`의 `expected report-6 to belong to job-6, got job-5`는 runPool이 완료 순서로 결과를 모아서 생긴 버그였다.
```

#### docs/knowledge/pool-results-keep-input-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 입력 순서와 같아야 하고, 보고서 임시 파일 이름은 reportId를 포함해야 한다

- 종류: 실패 유형
- 적용: 관련 위치 src/runner/pool.js, src/collect/collector.js, src/store/report-archive.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

- collectResults는 index로 job과 결과를 짝짓는다. runPool이 완료 순서로 결과를 모으면 지연이 다를 때 report-6이 job-5에 붙는다. 로컬 `npm test`는 지연이 없어 통과하므로 `ci/`에서만 가끔 실패한다.
- saveReport 임시 파일 이름이 ms 시각뿐이면 같은 ms에 시작한 동시 저장이 같은 임시 파일을 써서 ENOENT나 내용 뒤바뀜이 난다. reportId를 이름에 넣는다.
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

- t-02 fix: saveReport 임시 파일 이름은 reportId를 포함해야 한다. ms 시각뿐이면 같은 ms의 동시 저장이 충돌해 ENOENT와 내용 뒤바뀜이 난다 (src/store/report-archive.js)
- t-02 fix: 시각을 setNow로 고정하면 동시 저장 충돌을 지연 없이 로컬 npm test에서 재현할 수 있다 (test/archive.test.js)

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
`npm run test:ci`에서 `ci/archive.test.js`가 간헐적으로 실패하는 문제를 없앤다. 밤 배치 뒤 보고서가 보관소에 정확히 남아야 하고, 동시 실행에서도 항상 그래야 한다.

## 비목표
- `ci/batch.test.js`의 간헐 실패 (따로 고쳐서 리뷰 중)
- 동시성(4개)을 낮추거나 순차로 되돌리는 것

## 원하는 결과
`ci/archive.test.js`가 반복 실행해도 `ENOENT: 파일이 없습니다: reports/2026-09/*.tmp`나 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)` 없이 늘 통과한다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`ci/archive.test.js`를 여러 번 반복 실행해도 통과한다)
- [ ] `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm test`가 계속 통과한다
- [ ] 시험에 재시도, skip, 시간 제한 증가를 넣지 않고 `src/`의 원인을 고친다

## 제약
- (팀 지식 docs/knowledge/keep-parallel-concurrency.md) 간헐 실패가 동시성에서 드러나도 동시성(4개)을 낮추거나 순차로 되돌려 가리지 않는다. 동시 실행에서도 맞게 동작하도록 코드를 고친다.
- (팀 지식 docs/knowledge/no-retry-skip-for-flaky-tests.md) 간헐 실패 시험은 재시도, skip, 시간 제한 증가로 풀지 않고 지연(타이밍)에 따라 드러나는 원인을 src/에서 찾아 고친다.

## 추가 의견
- 로컬 `npm test`는 늘 통과하고 CI 전용 시험에서만 가끔 실패하며, 재실행하면 통과한다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-3/relay-home/projects/jobs-676026/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 12:42 (사람 승인)
없음

## t-02 fix — 2026-10-03 12:43 (자동 승인)
- [AI] 동시성은 그대로 두고 임시 파일 이름에 reportId를 넣어 고친다 — docs/knowledge/keep-parallel-concurrency.md, no-retry-skip-for-flaky-tests.md 규칙, 원인을 src/에서 고침
```

## 누적 기각 목록

- t-02 fix: runPool 결과 순서가 archive 실패의 원인: 보관본 내용은 순서와 무관하게 payload에서 옴

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "동시성은 그대로 두고 임시 파일 이름에 reportId를 넣어 고친다"
    why: "docs/knowledge/keep-parallel-concurrency.md, no-retry-skip-for-flaky-tests.md 규칙, 원인을 src/에서 고침"
    by: ai
assumptions:
  - "runPool 완료 순서 결과 수집은 batch.test.js 쪽 문제(비목표)라 고치지 않음"
rejected:
  - "runPool 결과 순서가 archive 실패의 원인: 보관본 내용은 순서와 무관하게 payload에서 옴"
open_questions: []
intent_deviation: null
risks:
  - "src/runner/pool.js는 여전히 완료 순서로 결과를 모음. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름은 reportId를 포함해야 한다. ms 시각뿐이면 같은 ms의 동시 저장이 충돌해 ENOENT와 내용 뒤바뀜이 난다 (src/store/report-archive.js)"
  - "시각을 setNow로 고정하면 동시 저장 충돌을 지연 없이 로컬 npm test에서 재현할 수 있다 (test/archive.test.js)"
---
## 요약
saveReport 임시 파일 이름에 reportId를 넣어 동시 저장 충돌(ENOENT, 보관본 뒤바뀜)을 고쳤다. 동시 저장 재현 시험을 추가했고 수정 전 실패, 수정 후 통과를 확인했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js` saveReport의 tmp 이름 `.<reportId>.<stamp>.tmp`.
- 시험: `test/archive.test.js` 마지막 시험(시각 고정).
- 결과: `npm run test:ci` 67 통과, `npm test` 63 통과, `ci/archive.test.js` 30회 반복 실패 0.
- 이 브랜치의 `pool.js`는 아직 완료 순서로 결과를 모음(비목표).
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-3/relay-home/projects/jobs-676026/works/w-20261003-002/tasks/02-fix/fix.md
