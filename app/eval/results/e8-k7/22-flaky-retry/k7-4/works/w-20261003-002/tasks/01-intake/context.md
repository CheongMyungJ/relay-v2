# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-01
- 업무 유형: 버그 수정 (`bugfix`)
- node: intake (의도 정리)
- skill: work-start
- 승인된 intent 버전: 없음 (의도 승인 전)
- task 디렉터리: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-4/relay-home/projects/jobs-3fa437/works/w-20261003-002/tasks/01-intake
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 5d3bf9fb88624b38399a1f082445676e42a6c847

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [의도 승인]을 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례(종류가 규칙)는 intent에 따르고 `제약`에 "(팀 지식 `<경로>`) <내용>"으로 옮겨 사람이 의도 승인에서 보게 한다. 조사로 알아낸 사실과 실패 유형은 이번 버그의 원인이라는 근거가 아니므로 intent에 쓰지 않고, handoff의 `## 다음 task가 알아야 할 것`에 참고할 항목의 경로만 적는다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/keep-parallel-concurrency-4.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 병렬 실행(동시 4개)은 유지한다. 순차로 되돌려 해결하지 않는다

- 종류: 규칙
- 적용: src/config.js (concurrency 기본 4), src/runner/pool.js
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

경쟁이나 순서 문제는 동시성을 낮춰 피하지 말고 원인(순서 가정, 공유 자원)을 고친다.
```

#### docs/knowledge/no-retry-skip-timeout-for-flaky.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 간헐 실패는 재시도·skip·시간 제한 늘리기로 해결하지 않는다

- 종류: 규칙
- 적용: ci/, test/ 전반
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

간헐 실패(재실행하면 통과)는 시험에 재시도를 붙이거나, skip하거나, 시간 제한을 늘려 덮지 않는다.
타이밍에 의존하는 원인을 소스 코드에서 찾아 고친다.
시험의 검증 내용을 약화하는 것도 해결이 아니다.
```

#### docs/knowledge/pool-results-in-items-order.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# runPool 결과는 완료 순서가 아니라 items 순서여야 한다

- 종류: 실패 유형
- 적용: 관련 위치 src/runner/pool.js, src/collect/collector.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

collectResults는 outcomes[i]와 jobs[i]를 짝짓는다고 가정한다. 끝나는 순서대로 push하면 지연이 다를 때 report-N이 다른 job에 붙는다.
증상: `expected report-6 to belong to job-6, got job-5` (ci/batch.test.js, 조회 지연 지터 때문에 가끔만).
test/는 지연이 없어 못 잡는다. 결정적 시험은 지연을 [30,1,15,5]처럼 고정한다.
```

#### docs/knowledge/report-temp-file-name-must-be-unique.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 보고서 임시 파일 이름은 작업마다 달라야 한다 (시각만으로는 겹친다)

- 종류: 실패 유형
- 적용: 관련 위치 src/store/report-archive.js (saveReport), src/util/ids.js (stamp)
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

같은 폴더에 동시(4개) 저장하면 같은 ms에 시작한 저장들이 시각 꼬리표만 쓴 임시 이름을 공유해 서로의 내용을 덮어쓴다.
증상: ci/archive.test.js에서 보관본의 고객사가 다름(expected 'stark', actual 'wayne'), 임시 파일 잔존. test/는 시계를 가짜로 써 못 잡는다.
임시 이름에는 reportId처럼 작업마다 다른 값을 넣는다. 결정적 시험은 sleep을 멈춰 같은 시각을 만든다.
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.

## 선택 가능한 다음 단계

- 기본 다음 단계: fix (원인 분석과 수정)
- 이전 단계: 없음

## intent

없음 (의도 승인 전)

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/22-flaky-retry-k7-4/relay-home/projects/jobs-3fa437/works/w-20261003-002/request.md

```text
CI의 npm run test:ci가 요즘 또 가끔 실패한다. 이번에는 ci/archive.test.js(밤 배치 뒤 보고서가 보관소에 제대로 남는지 보는 CI 전용 시험)다. 로컬 npm test는 늘 통과한다. 실패 로그는 그때그때 조금씩 다른데, 보통 `ENOENT: 파일이 없습니다: reports/2026-09/.mups96qp.tmp`이고 `report-6 보관본의 고객사가 다르다: wayne (stark여야 함)`이 함께 나올 때도 있다. 재실행하면 통과한다. ci/batch.test.js가 가끔 실패하는 것은 따로 고쳐서 리뷰 중이니 이번 범위가 아니다.
```

## 결정 로그

없음

## 누적 기각 목록

없음

## 직전 handoff

없음

## 필요한 산출물

없음
