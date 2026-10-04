# 배치 결과 순서와 보고서 임시 파일 이름 충돌 수정

## 요약
`test:ci`의 간헐 실패 두 가지를 제품 코드에서 고쳤다. 병렬 실행(동시 4개)은 유지했고 시험 쪽 우회는 없다.

## 원인
- `runPool`이 끝난 순서대로 결과를 모아, 지연이 있으면 `collectResults`가 기록을 다른 작업에 붙였다.
- `saveReport`의 임시 파일 이름이 시각뿐이라 같은 ms에 동시에 저장하는 보고서끼리 겹쳤다.

## 변경
- src/runner/pool.js: 결과를 입력 순서 자리(`results[start + i]`)에 넣는다.
- src/store/report-archive.js: 임시 파일 이름에 reportId를 넣는다.
- test/pool.test.js, test/archive.test.js: 재현 테스트 추가.
- docs/knowledge: flaky 시험 처리 규칙과 이번 실패 유형 기록.

## 테스트
- `npm test`: 64 통과
- `npm run test:ci` 20회 중 20회 통과
- `ci/batch.test.js` 20회 중 20회 통과 (기준 커밋은 8회 중 4회 실패)
