## 리뷰 지적
1. [사소] src/store/report-archive.js:24 — 같은 reportId를 같은 ms에 동시에 저장하면 임시 이름이 여전히 겹침. 호출마다 늘어나는 번호를 더하자고 제안.
2. [사소] test/archive.test.js:77 — 회귀 시험이 서로 다른 reportId만 다룸. 같은 id 동시 저장 시험 추가 제안.

## 반영
- 1, 2 (사람이 "모두 반영" 선택) — 임시 이름에 모듈 번호(`tmpSeq`)를 더하고 같은 id 동시 저장 시험을 추가. 커밋 9aea388. `npm test` 64 통과, `npm run test:ci` 68 통과, `node --test ci/archive.test.js` 20회 fail 0. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다 | 통과 | 최종 코드에서 `npm run test:ci` 68 통과 fail 0, 아래 archive 20회 반복도 전부 통과 |
| `npm test`가 통과한다 | 통과 | pass 64 fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff b1aee9b`는 test/archive.test.js에 시험 추가만 있고 삭제·수정 없음 |
| `npm run test:ci`가 통과한다 | 통과 | pass 68 fail 0 |
| 실패 조건을 결정적으로 재현하는 회귀 시험이 `npm test`에 추가되어 있고, 수정 전 실패 / 수정 후 통과 | 통과 | 수정 전 코드(reportId 추가 전)로 되돌리면 `node --test test/archive.test.js` fail 1, 번호 제거 상태에서는 같은 id 시험이 fail 1, 최종 코드 pass 11 fail 0 |
| 배치의 병렬 실행(동시 4개)이 유지된다 | 통과 | `src/config.js:4` concurrency 4 그대로, `src/runner/`·pool 변경 없음(diff는 report-archive.js와 시험뿐) |
| `ci/archive.test.js`를 연속 20회 반복 실행한 결과가 기록되어 있고 20회 모두 통과 | 통과 | 직접 20회 반복, 실패 0 (fix.md에도 기록) |
| 시험의 재시도, skip, 시간 제한 늘리기, 지연 설정 줄이기 없이 통과한다 | 통과 | diff에 ci/ 시험 변경 없음, 새 시험은 `setSleep`으로 시각만 고정하고 지연 설정은 그대로 |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 시험 2개 추가만 있고 기존 시험·단언은 그대로.

## 남은 위험
- 호출 번호는 프로세스 안에서만 유일하다. 여러 프로세스가 같은 보관소에 같은 ms에 같은 reportId를 저장하면 겹칠 수 있다(현재 배치는 단일 프로세스).
- 앞 Work(w-20261004-001)에서 runPool 순서를 고쳤을 수 있음, 머지 대기. ci/batch.test.js는 비목표.
