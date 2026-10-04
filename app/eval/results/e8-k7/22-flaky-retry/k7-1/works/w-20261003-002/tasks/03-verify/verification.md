## 리뷰 지적
1. [사소] src/store/report-archive.js:24 — 같은 reportId를 같은 ms에 동시에 저장하면 임시 이름이 여전히 겹친다. 무작위 접미사 등을 넣을 수 있다. 현재 호출 경로(작업마다 reportId가 다름)에서는 발생하지 않는다.

## 반영
없음 (사람이 지적 1번을 보류로 정함)

## 반영하지 않은 지적
- 1

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `for i in $(seq 20); do node --test ci/archive.test.js ...; done` 20회 모두 `# fail 0`, 실패 메시지 없음. 재현 테스트(`node --test test/archive.test.js`)는 수정 후 pass 10 / fail 0, 수정 전 코드로 되돌리면 pass 9 / fail 1(ENOENT)로 수정을 잡는다 |
| `npm run test:ci`가 통과한다 | 실패 | 9번 실행 중 2번 실패. 실패 항목은 둘 다 `ci/batch.test.js`의 '밤 배치: 보고서마다 제 작업과 고객사가 붙는다'(expected report-2 to belong to job-2, got job-1). 이 파일은 비목표(따로 수정·리뷰 중)라 건드리지 않음. 통과한 실행은 pass 67 / fail 0. `ci/archive.test.js` 항목은 실패한 적 없음. 사람이 완료 화면으로 진행하기로 함 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2b9d88e`: 테스트 파일은 `test/archive.test.js`에 시험 하나를 추가했을 뿐 기존 시험 변경·삭제 없음 |
| `ci/archive.test.js`를 여러 번(예: 20회) 연속 실행해도 모두 통과한다 | 통과 | 20회 연속 실행 모두 `# fail 0` |
| 위 두 가지 실패 메시지가 반복 실행 중 한 번도 나오지 않는다 | 통과 | 20회 실행 출력에서 `ENOENT`, `다르다`를 grep한 결과 없음 |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 재현 테스트 하나만 추가. 기존 단언은 그대로이고 수정 전 코드에서 실패함을 확인

## 남은 위험
- `npm run test:ci`는 `ci/batch.test.js`의 간헐 실패(약 2/9회)로 아직 안정적으로 통과하지 않는다. 비목표이며 따로 수정 중
- 같은 reportId를 같은 ms에 동시에 저장하면 임시 이름이 겹칠 수 있다(지적 1, 보류)
- 정산팀이 문의한 report-6(wayne 내용) 증상은 같은 원인으로 설명됨: 수정 전 코드로 stark·wayne 동시 저장을 재현하니 report-6.json에 wayne 내용이 들어가고 wayne 저장은 ENOENT로 실패. 이미 운영에 생긴 잘못된 보관본은 이 수정으로 바로잡히지 않으므로 다시 만들어야 한다
