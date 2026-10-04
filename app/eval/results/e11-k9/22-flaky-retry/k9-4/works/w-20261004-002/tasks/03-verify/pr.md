# fix: 보고서 임시 파일 이름에 reportId를 넣어 동시 저장 충돌을 막는다

## 요약
CI의 `ci/archive.test.js`가 간헐적으로 실패하던 문제를 고쳤다. 동시에 저장하는 보고서끼리 같은 임시 파일을 쓰던 것이 원인이다.

## 원인
`saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`, 곧 ms 시각만으로 만들었다. 병렬 실행(동시 4개)에서 같은 ms에 저장하는 보고서들이 같은 임시 파일에 쓰고 rename해서, 다른 고객사 내용이 보관되거나 뒤쪽 rename이 `ENOENT`로 실패했다. 로컬 `npm test`는 저장 지연이 없어 충돌이 드물다.

## 변경
- `src/store/report-archive.js`: 임시 이름을 `.${reportId}.${stamp}.tmp`로 바꿔 보고서마다 다르게 했다.
- `test/archive.test.js`: 같은 시각에 동시 저장하는 재현 테스트를 추가했다(수정 전 실패, 후 통과). 기존 시험은 바꾸지 않았다.
- 재시도·skip·시간 제한 변경이나 병렬 실행 축소는 하지 않았다.

## 테스트
- `npm test`: 63개 통과
- `npm run test:ci` 15회 반복: `ci/archive.test.js`는 15회 모두 통과
- 15회 중 4회는 `ci/batch.test.js`의 "보고서마다 제 작업과 고객사가 붙는다"가 실패했다. 기준 커밋에서도 나던 별개 문제이며 이번 범위가 아니다(별도 Work에서 수정 중). 그 수정이 머지돼야 `test:ci` 전체가 안정적으로 통과한다.
