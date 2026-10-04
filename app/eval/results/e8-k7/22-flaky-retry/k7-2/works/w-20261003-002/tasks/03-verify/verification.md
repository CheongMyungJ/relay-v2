## 리뷰 지적
없음

(확인한 것: 원인(`saveReport`의 ms 시각만 쓴 임시 파일 이름)을 직접 고쳤고 증상만 가리지 않는다. 병렬 4개, 재시도, timeout은 그대로다. `.tmp` 이름에 의존하는 코드는 `strayTemps`(접미사 `.tmp`만 봄)뿐이라 영향이 없다. 기준 커밋에서 ci/archive.test.js 40회 중 ENOENT 8회, 고객사 불일치(`report-7 ... wonka (wayne여야 함)`) 2회가 났고, 둘 다 같은 임시 파일 충돌이다.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`를 20회 반복해 ci/archive.test.js가 한 번도 실패하지 않는다) | 통과 | `node --test ci/archive.test.js` 20회 실패 0, 추가로 60회 ENOENT·고객사 불일치 0. `npm run test:ci` 20회에서 실패한 5회는 모두 ci/batch.test.js였고 archive 실패는 없었다 |
| `npm test`와 `npm run test:ci`가 통과한다 | 실패 | `npm test` 63개 통과. `npm run test:ci`는 20회 중 5회 실패, 전부 ci/batch.test.js '밤 배치: 보고서마다 제 작업과 고객사가 붙는다'(비목표, runPool 결과 순서, 별도 Work w-20261003-001). 사람이 그대로 완료 화면으로 가기로 함 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 54b9280`: test/archive.test.js에 테스트 추가만 있고 삭제·수정 없음 |
| ci/archive.test.js의 검증 내용(보관본의 존재와 고객사 일치)이 그대로 유지된다 | 통과 | ci/archive.test.js는 base 이후 변경 없음 |
| 배치 동시 실행 수(기본 4)가 그대로다 | 통과 | src/config.js, src/runner/*는 변경 없음 (변경 파일은 report-archive.js, archive.test.js뿐) |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 시각을 고정해 동시 저장을 재현하는 테스트 1개를 추가했을 뿐 기존 테스트는 그대로다. 수정 전에는 실패하고 수정 후에는 통과한다고 fix.md에 기록돼 있다

## 남은 위험
- `npm run test:ci`는 ci/batch.test.js 간헐 실패(비목표) 때문에 가끔 실패한다. 그 Work(w-20261003-001)가 머지돼야 안정된다
- 정산팀이 임시 파일 이름 규칙(`.<시각>.tmp`)에 의존하는지 확인하지 못했다
- 같은 reportId를 동시에 저장하는 경우는 막지 않는다
