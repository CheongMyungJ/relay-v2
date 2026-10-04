# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-5/relay-home/projects/jobs-60cf5a/works/w-20261003-002/tasks/03-verify
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: ff52f88fdc22da09556fdd624c9bb2ce7bf7a75d

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

#### docs/knowledge/ci-tests-expose-ordering-races.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# ci/ 시험은 지연 jitter로 완료 순서가 바뀔 때만 실패한다

- 종류: 실패 유형
- 적용: ci/batch.test.js, ci/archive.test.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

로컬 npm test는 지연이 없어 완료 순서가 입력 순서와 같아 늘 통과한다. 순서나 동시 시작 시각에 의존하는 버그는 npm run test:ci에서만 가끔 드러난다.
비슷한 사례: saveReport 임시 파일 이름이 같은 ms에 겹쳐 ci/archive.test.js가 간헐 실패했다(이름에 reportId를 넣어 고침).
확인은 ci 시험을 20회 이상 반복 실행한다.
```

#### docs/knowledge/keep-batch-parallelism.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 배치의 병렬 실행(동시 4개)은 flaky 해결을 위해 줄이거나 순차로 되돌리지 않는다

- 종류: 규칙
- 적용: src/runner/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

순차 실행으로 되돌리거나 동시 실행 수를 줄이는 것은 해결이 아니다. 병렬(기본 동시 4개)을 유지한 채 근본 원인을 고친다.
까닭: 순서 의존 버그는 병렬을 없애면 가려질 뿐 남아 있다.
```

#### docs/knowledge/no-flaky-workarounds.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# flaky 시험은 재시도, skip, 시간 제한 증가가 아니라 근본 원인을 고친다

- 종류: 규칙
- 적용: test/, ci/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패(재실행하면 통과)를 재시도, skip, timeout 증가, 지연 값이나 검증 완화로 넘기지 않는다.
src/ 코드의 원인을 찾아 고친다. 예: 'expected report-6 to belong to job-6, got job-5'는 시험이 아니라 runPool 순서 버그였다.
```

#### docs/knowledge/runpool-preserve-input-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 입력 순서여야 한다

- 종류: 규칙
- 적용: src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults는 outcomes[i]가 jobs[i]의 결과라고 인덱스로 짝짓는다. 그래서 runPool은 완료 순서가 아니라 items 순서로 결과를 돌려줘야 한다.
틀린 예: 완료 순서로 results.push → 조회 지연 jitter로 같은 묶음 안 순서가 바뀌면 report-6이 job-5 기록에 붙는다.
맞는 예: results[start + i]에 넣는다. 회귀 시험: test/pool.test.js.
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

- t-02 fix: saveReport 임시 파일 이름은 reportId를 포함해야 한다. stamp(ms)만 쓰면 같은 ms 동시 저장이 겹쳐 ci/archive.test.js가 ENOENT로 간헐 실패한다
- t-02 fix: test/ 시험은 sleep을 가짜로 바꿔 동시성 문제가 드러나지 않는다. 동시성 버그는 ci/ 시험을 20회 이상 반복해 확인한다

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
`npm run test:ci`에서 ci/archive.test.js가 간헐적으로 실패하는 문제를 근본 원인부터 고친다. 밤 배치 뒤 보고서가 보관소에 제대로 남아야 한다.

## 비목표
- ci/batch.test.js의 간헐 실패는 별도 Work에서 고쳐 리뷰 중이므로 다루지 않는다.
- 배치 병렬 실행(기본 동시 4개)을 줄이거나 순차로 되돌리지 않는다.

## 원하는 결과
ci/archive.test.js가 반복 실행해도 항상 통과한다. 보관본이 올바른 고객사의 것이고, 보관 중 임시 파일(`reports/2026-09/.*.tmp`)이 없어져 ENOENT가 나지 않는다.

## 완료조건
- [ ] 재현 절차(ci/archive.test.js 반복 실행)가 더 이상 실패하지 않는다
- [ ] `npm run test:ci`가 통과한다 (`npm test`도 통과한다)
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `npm run test:ci`를 20회 반복 실행해 모두 통과한다
- [ ] 시험 코드(test/, ci/)에서 재시도, skip, timeout 증가, 지연 값·검증 완화를 쓰지 않는다

## 제약
- (팀 지식 docs/knowledge/no-flaky-workarounds.md) 간헐 실패를 재시도, skip, timeout 증가, 지연 값이나 검증 완화로 넘기지 않고 src/ 코드의 원인을 찾아 고친다.
- (팀 지식 docs/knowledge/keep-batch-parallelism.md) src/runner/의 병렬 실행(기본 동시 4개)을 유지한 채 근본 원인을 고친다.

## 추가 의견
- 실패 로그는 매번 조금씩 다르다. 주로 `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`, 가끔 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 함께 나온다.
- 로컬 `npm test`는 늘 통과하고 CI에서만, 재실행하면 통과하는 간헐 실패다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-5/relay-home/projects/jobs-60cf5a/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 13:30 (사람 승인)
- [사람] ci/batch.test.js 간헐 실패와 병렬도 변경은 비목표로 둔다 — 요청이 batch 쪽은 따로 리뷰 중이라고 밝혔고, 팀 규칙이 병렬 유지를 요구함

## t-02 fix — 2026-10-03 13:31 (자동 승인)
- [AI] 고객사 불일치 원인인 runPool 완료 순서 버그도 함께 고친다 — 요청의 로그에 고객사 불일치가 함께 나오고 docs/knowledge/runpool-preserve-input-order.md 규칙이 같은 수정을 요구함. 병렬도는 그대로
```

## 누적 기각 목록

- t-02 fix: 병렬도 축소나 순차 실행: 비목표이자 팀 규칙(keep-batch-parallelism)
- t-02 fix: 재시도, timeout 증가: 팀 규칙(no-flaky-workarounds)

## 직전 handoff (t-02 fix)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "고객사 불일치 원인인 runPool 완료 순서 버그도 함께 고친다"
    why: "요청의 로그에 고객사 불일치가 함께 나오고 docs/knowledge/runpool-preserve-input-order.md 규칙이 같은 수정을 요구함. 병렬도는 그대로"
    by: ai
assumptions:
  - "ci/batch.test.js의 간헐 실패는 pool 순서 문제와 겹칠 수 있으나, 앞 Work 몫이라 따로 확인하지 않음"
rejected:
  - "병렬도 축소나 순차 실행: 비목표이자 팀 규칙(keep-batch-parallelism)"
  - "재시도, timeout 증가: 팀 규칙(no-flaky-workarounds)"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 순서(src/runner/pool.js)와 임시 파일 이름. 머지 시 충돌 가능"
  - "test/archive.test.js의 새 시험은 수정 전에도 통과해 회귀 방지 효과가 약함"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름은 reportId를 포함해야 한다. stamp(ms)만 쓰면 같은 ms 동시 저장이 겹쳐 ci/archive.test.js가 ENOENT로 간헐 실패한다"
  - "test/ 시험은 sleep을 가짜로 바꿔 동시성 문제가 드러나지 않는다. 동시성 버그는 ci/ 시험을 20회 이상 반복해 확인한다"
---
## 요약
ci/archive.test.js 간헐 실패의 원인 두 가지를 고쳤다. 임시 파일 이름 충돌(ENOENT)과 runPool 완료 순서 결과(고객사 불일치). 병렬도는 그대로이고 test:ci 20회가 모두 통과했다.
## 다음 task가 알아야 할 것
- 수정: src/store/report-archive.js(saveReport tmp 이름), src/runner/pool.js(results[start + i])
- 수정 전 ci/archive.test.js 20회 중 9회 실패, 수정 후 test:ci 20회 0회 실패
- 시험: test/pool.test.js 순서 시험 추가(수정 전 실패), test/archive.test.js 동시 저장 시험 추가
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-5/relay-home/projects/jobs-60cf5a/works/w-20261003-002/tasks/02-fix/fix.md
