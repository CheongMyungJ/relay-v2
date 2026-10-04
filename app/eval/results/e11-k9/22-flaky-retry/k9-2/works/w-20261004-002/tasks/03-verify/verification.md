## 리뷰 지적
1. [사소] src/store/report-archive.js:24 — 같은 reportId를 같은 ms에 동시 저장하면 임시 이름이 여전히 겹친다. 호출마다 늘어나는 카운터를 더하는 안. 서로 다른 보고서가 섞이는 이번 원인과 무관한 중복 저장 문제.
2. [차단] src/runner/pool.js:18 — `runPool`이 결과를 완료 순서로 push하고 `collectResults`(src/collect/collector.js:46)가 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓는다. 실패한 작업은 일찍 끝나 순서가 앞당겨지므로 작업과 결과(고객사)가 어긋난다. 정산팀이 말한 "파일 이름과 다른 고객사 보고서 + 그날 실패한 작업 하나"는 임시 파일 충돌만으로 설명되지 않고 이 경로와 맞는다. fix.md는 이 가설을 "archive 시험 실패와 무관"으로 기각했으나 운영 사고와 대조하지 않았다. 제안: 병렬은 유지하고 결과를 `results[start + i]`처럼 입력 순서 자리에 넣고, `onChunk`의 `done`은 별도 카운터로 센다.

## 반영
없음 (2번은 사람이 fix 단계로 돌아가 고치기로 함. 이 단계에서는 코드를 바꾸지 않았다)

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음으로 고름)
- 2 (이 단계에서 반영하지 않고 fix로 되돌림, recommended_next: fix)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`의 ci/archive.test.js가 `ENOENT ... .tmp`, `보관본의 고객사가 다르다`로 실패하지 않는다) | 통과 | `npm run test:ci` 20회 재실행, 출력에서 `ENOENT`/`고객사가 다르다` 0회. 단, test:ci 자체는 batch 실패로 4회 실패 |
| `npm test`와 `npm run test:ci`가 통과한다 | 실패 | `npm test`는 63 pass/0 fail. `npm run test:ci`는 20회 중 4회(8,11,13,16번째) 실패, 모두 ci/batch.test.js '밤 배치: 보고서마다 제 작업과 고객사가 붙는다' (`expected report-7 to belong to job-7, got job-6`). runPool 결과 순서 문제(지적 2) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff <기준>`: test/archive.test.js에 시험 추가만 있고 기존 줄 변경·삭제 없음 |
| `npm run test:ci`를 반복 실행(예: 20회)해도 ci/archive.test.js가 한 번도 실패하지 않는다 | 통과 | 20회 중 archive 시험 실패 0회. 새 시험은 수정 전 코드로 되돌리면 `not ok 7`(pass 62/fail 1)로 실패함을 직접 확인 |
| 시험 파일에 재시도, skip, 시간 제한 증가, LATENCY 축소가 추가되지 않았다 | 통과 | 시험 diff는 새 시험 1개(setSleep 즉시 반환으로 시계 정지)뿐. 재시도·skip·시간 제한·LATENCY 변경 없음 |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 기존 시험은 그대로, 같은 ms 동시 저장 시험만 추가. setSleep은 afterEach의 resetSleep으로 복원됨

## 남은 위험
- `runPool` 결과 순서 문제가 남아 있어 병렬 배치에서 작업 실패가 섞이면 결과와 고객사가 어긋날 수 있다(운영 사고 후보). 원하는 결과의 "고객사 내용이 섞이지 않는다"가 완전히 보장되지 않는다.
- 이 문제는 intent 비목표("batch 간헐 실패는 따로 고쳐 리뷰 중")와 겹친다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
- 정산팀 사고가 runPool 때문이라는 것은 코드 경로와 시험 실패로 설명되는 정황이며, 운영 기록으로 확인하지 않았다.
