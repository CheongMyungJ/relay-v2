## 리뷰 지적
1. [사소] src/store/report-archive.js:23 — 같은 reportId를 같은 밀리초에 동시 저장하면 임시 이름이 여전히 겹칠 수 있다. 호출마다 늘어나는 번호를 더하자.
2. [사소] test/archive.test.js:99 — setSleep을 덮어써 시각을 고정하는 의도가 주석에 없다.

## 반영
- 1, 2 — 모듈 변수 `tmpSeq`를 임시 이름 끝에 더함(`.${reportId}-${stamp}-${tmpSeq}.tmp`), 시험 주석 보강. 커밋 46abc61. `npm test` 통과(pass 63, fail 0), `node --test ci/archive.test.js` 40회 모두 통과, `npm run test:ci` 10회 중 8회 통과·2회 실패(실패는 모두 ci/batch.test.js, archive 관련 실패 0). 재현 절차는 바뀌지 않음.
- 지식: docs/knowledge/store/report-temp-file-name.md 새로 남김, docs/knowledge/testing/flaky-test-policy.md는 앞 Work 내용 그대로 같은 경로에 옮김.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다 | 실패 | 10회 중 2회 실패. 실패는 모두 `ci/batch.test.js` "보고서마다 제 작업과 고객사가 붙는다"(비목표, 기준 커밋에서도 20회 중 6회 실패). 원래 증상(archive의 ENOENT·고객사 불일치)은 재현되지 않음. 사람이 이대로 완료 화면으로 가기로 함 |
| `npm test`와 `npm run test:ci`가 통과한다 | 실패 | `npm test` 통과(63/0). `npm run test:ci`는 위와 같이 batch 간헐 실패로 가끔 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff fe93e45`: 테스트 파일은 시험 1개 추가뿐, 삭제·수정 없음 |
| `ci/archive.test.js`를 `npm run test:ci`로 여러 번 반복 실행해도 한 번도 실패하지 않는다 | 통과 | `node --test ci/archive.test.js` 40회 실패 0, test:ci 10회 중 archive 관련 실패 0 |
| 시험에 재시도, skip, 시간 제한 증가를 추가하지 않는다 | 통과 | diff에 재시도·skip·시간 제한 변경 없음(추가된 시험은 지연 없는 sleep 고정뿐) |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 기존 시험은 그대로, 재현 시험 하나만 추가(주석 보강 포함)

## 남은 위험
- `npm run test:ci`는 ci/batch.test.js 간헐 실패로 가끔 실패한다. 비목표이며 별도 Work에서 리뷰 중이다.
- tmpSeq는 프로세스 안에서만 유일하다. 여러 프로세스가 같은 폴더에 같은 밀리초·같은 reportId로 쓰면 겹칠 수 있다.
