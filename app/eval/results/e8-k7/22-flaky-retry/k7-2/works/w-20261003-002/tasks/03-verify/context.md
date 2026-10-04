# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-2/relay-home/projects/jobs-535597/works/w-20261003-002/tasks/03-verify
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 54b92803cd1365143036cd5aaf186882a49bba0e

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

#### docs/knowledge/archive-tmp-name-needs-unique-part.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 보관 임시 파일 이름에 ms 시각만 쓰면 동시 저장에서 겹친다

- 종류: 실패 유형
- 적용: src/store/report-archive.js (saveReport)
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

`.${stamp(now())}.tmp`처럼 ms 시각만으로 만든 임시 파일 이름은 같은 ms에 동시 저장하는 두 작업이 같은 파일을 써서,
뒤 작업의 rename이 `ENOENT`로 실패한다(ci/archive.test.js가 간헐 실패). 이름에 reportId 같은 고유 요소를 넣는다.
같은 reportId를 동시에 저장하는 경우까지는 막지 않는다. 임시 파일 이름 규칙에 의존하는 쪽(정산팀)이 있으면 확인한다.
```

#### docs/knowledge/batch-keeps-parallel-concurrency-4.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 배치는 병렬(동시 4개)로 실행한다. 순차 실행으로 되돌리는 것은 해결이 아니다

- 종류: 규칙
- 적용: src/runner/pool.js, src/runner/runner.js, src/config.js (concurrency 기본 4)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

배치 결과가 어긋나거나 시험이 흔들릴 때 concurrency를 1로 낮추는 식의 순차 실행 복귀는 해결로 인정하지 않는다.
병렬(동시 4개)을 유지한 채 원인을 고친다. 예: runPool은 결과를 끝난 순서가 아니라 items의 인덱스 자리에 넣는다.
```

#### docs/knowledge/no-retry-skip-timeout-for-flaky-tests.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 간헐 실패 시험은 재시도·skip·시간 제한 증가가 아니라 원인을 고친다

- 종류: 규칙
- 적용: ci/, test/, 간헐 실패(flaky) 대응 전반
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패하는 시험에 재시도를 붙이거나, skip하거나, timeout을 늘리는 것은 해결로 인정하지 않는다.
시험의 검증을 약화하는 것도 마찬가지다. 원인을 찾아 제품 코드(또는 시험의 잘못된 가정)를 고친다.
예: `expected report-6 to belong to job-6, got job-5`는 시간 문제가 아니라 결과 순서 문제였다 (src/runner/pool.js).
로컬 `npm test`는 ci/를 포함하지 않아 늘 통과하므로, 재현은 `npm run test:ci`를 여러 번(예: 20회) 반복한다.
```

#### docs/knowledge/runpool-results-in-items-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 items 순서여야 한다

- 종류: 실패 유형
- 적용: src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults가 결과를 인덱스로 작업과 짝짓는다. runPool이 결과를 끝난 순서로 push하면 지연 순서에 따라
report가 다른 job에 붙는다(report-2가 job-1 소속으로 보임). 지연이 없는 로컬 환경에서는 드러나지 않는다.
결과는 `results[start + i]`처럼 items 인덱스 자리에 넣는다. 병렬 실행 자체는 바꾸지 않는다.
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

- t-02 fix: report-archive.js saveReport의 임시 파일 이름은 reportId를 포함해야 한다. 같은 ms에 동시 저장하면 ENOENT와 다른 고객사 내용이 섞이는 증상이 함께 나온다
- t-02 fix: test/archive.test.js의 가짜 시계는 sleep마다 시각이 흘러 임시 파일 이름 충돌이 가려진다. 충돌 재현에는 시각을 고정해야 한다

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
CI의 `npm run test:ci`에서 ci/archive.test.js(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 시험)가 간헐적으로 실패하는 원인을 찾아 고친다.

## 비목표
- ci/batch.test.js의 간헐 실패 (별도 Work에서 리뷰 중)
- 배치 실행 방식(병렬 동시 4개)을 바꾸는 것

## 원하는 결과
ci/archive.test.js가 반복 실행해도 안정적으로 통과한다. 보관소에는 각 보고서가 올바른 고객사 내용으로 남고, 아래 두 실패가 더 나오지 않는다.
- `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp` (주로 나타남)
- `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)` (가끔 함께 나타남)

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`를 20회 반복해 ci/archive.test.js가 한 번도 실패하지 않는다)
- [ ] `npm test`와 `npm run test:ci`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] ci/archive.test.js의 검증 내용(보관본의 존재와 고객사 일치)이 그대로 유지된다
- [ ] 배치 동시 실행 수(기본 4)가 그대로다

## 제약
- (팀 지식 docs/knowledge/no-retry-skip-timeout-for-flaky-tests.md) 간헐 실패 시험은 재시도, skip, timeout 증가로 해결하지 않고 원인을 고친다. 시험 검증을 약화하는 것도 해결이 아니다.
- (팀 지식 docs/knowledge/batch-keeps-parallel-concurrency-4.md) concurrency를 1로 낮추는 순차 실행 복귀는 해결이 아니다. 병렬(동시 4개)을 유지한 채 고친다.
- 로컬 `npm test`는 ci/를 포함하지 않아 늘 통과한다. 재현은 `npm run test:ci` 반복으로 한다.

## 추가 의견
- 재실행하면 통과하는 간헐 실패다. 실패 로그는 그때그때 조금씩 다르다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-2/relay-home/projects/jobs-535597/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 12:17 (사람 승인)
- [AI] 배치 병렬 동시 4개 유지와 재시도/skip/timeout 증가 금지를 제약에 넣는다 — 팀 지식의 사람이 정한 규칙이며 이번 경우(간헐 실패, 시험 흔들림)에 해당한다
- [사람] ci/batch.test.js 간헐 실패는 비목표로 둔다 — 요청에서 별도 Work로 리뷰 중이라고 명시함

## t-02 fix — 2026-10-03 12:19 (자동 승인)
- [AI] 임시 파일 이름에 reportId를 넣는 방식으로 고친다 (순차화, 재시도, timeout 증가는 쓰지 않음) — 팀 지식 docs/knowledge/archive-tmp-name-needs-unique-part.md, no-retry-skip-timeout-for-flaky-tests.md, batch-keeps-parallel-concurrency-4.md
```

## 누적 기각 목록

- t-02 fix: runPool 결과 순서 수정: ci/batch.test.js의 원인이며 이번 Work의 비목표

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는 방식으로 고친다 (순차화, 재시도, timeout 증가는 쓰지 않음)"
    why: "팀 지식 docs/knowledge/archive-tmp-name-needs-unique-part.md, no-retry-skip-timeout-for-flaky-tests.md, batch-keeps-parallel-concurrency-4.md"
    by: ai
assumptions:
  - "정산팀이 임시 파일 이름 규칙(`.<시각>.tmp`)에 의존하지 않는다고 가정함. 확인하지 못함"
rejected:
  - "runPool 결과 순서 수정: ci/batch.test.js의 원인이며 이번 Work의 비목표"
open_questions: []
intent_deviation: null
risks:
  - "`npm run test:ci`는 ci/batch.test.js 간헐 실패(기준 커밋에서도 발생, 비목표) 때문에 가끔 실패한다. 완료조건 '`npm run test:ci` 통과'는 그 Work가 머지돼야 안정적으로 충족된다"
  - "같은 reportId를 동시에 저장하는 경우는 여전히 막지 않는다"
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서(src/runner/pool.js)"
recommended_next: null
knowledge_candidates:
  - "report-archive.js saveReport의 임시 파일 이름은 reportId를 포함해야 한다. 같은 ms에 동시 저장하면 ENOENT와 다른 고객사 내용이 섞이는 증상이 함께 나온다"
  - "test/archive.test.js의 가짜 시계는 sleep마다 시각이 흘러 임시 파일 이름 충돌이 가려진다. 충돌 재현에는 시각을 고정해야 한다"
---
## 요약
ci/archive.test.js 간헐 실패의 원인은 보관 임시 파일 이름이 ms 시각만이라 병렬 저장이 같은 파일을 쓰는 것이었다. `ENOENT`와 고객사 불일치는 같은 원인이다. 이름에 reportId를 넣어 고쳤고 20회 반복에서 실패가 없다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23`, 커밋 63f2c82. 재현 테스트는 test/archive.test.js 마지막 부근(시각 고정).
- 확인 명령: `for i in $(seq 20); do node --test ci/archive.test.js; done` 실패 0.
- `npm run test:ci`가 가끔 실패하는 것은 ci/batch.test.js(기준 커밋에서도 실패, 비목표) 때문이다.
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-2/relay-home/projects/jobs-535597/works/w-20261003-002/tasks/02-fix/fix.md
