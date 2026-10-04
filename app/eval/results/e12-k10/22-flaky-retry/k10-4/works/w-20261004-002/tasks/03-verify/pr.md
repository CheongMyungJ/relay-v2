# fix: 보고서 임시 파일 이름이 겹쳐 ci/archive.test.js가 간헐 실패하던 문제 수정

## 요약
`saveReport`의 임시 파일 이름이 밀리초 시각뿐이라 동시 4개 저장이 겹치던 것을 reportId와 호출 번호를 넣어 고쳤다.

## 원인
같은 ms에 시작한 저장들이 같은 임시 경로를 써서 ENOENT와 다른 고객사의 보관본이 생겼다.

## 변경
- `src/store/report-archive.js`: 임시 이름 `.<reportId>-<시각>-<번호>.tmp`
- `test/archive.test.js`: 시각 고정 동시 저장 회귀 시험 2개 추가
- `docs/knowledge/store/report-temp-file-name.md`: 지식 추가
- 병렬 4개, 시험 지연·재시도 설정은 그대로

## 테스트
- `npm test` 64 통과, `npm run test:ci` 68 통과
- `node --test ci/archive.test.js` 20회 연속 통과
- 회귀 시험은 수정 전 코드에서 실패
