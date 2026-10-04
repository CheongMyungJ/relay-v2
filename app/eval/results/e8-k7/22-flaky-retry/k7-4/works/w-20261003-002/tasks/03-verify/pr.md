# fix: 보고서 임시 파일 이름에 reportId를 넣어 동시 저장 충돌 방지

## 요약
`ci/archive.test.js`가 가끔 `ENOENT ... .tmp`나 고객사 뒤바뀜으로 실패하던 간헐 실패를 고쳤다. 동시성(4개)과 시험은 그대로 두고 소스의 원인을 고쳤다.

## 원인
`saveReport`가 임시 파일 이름을 시각 꼬리표만으로 만들어(`.${stamp(now())}.tmp`), 같은 ms에 시작한 동시 저장들이 같은 임시 파일을 공유했다. 한 저장이 rename하면 다른 저장은 ENOENT가 되고, 서로의 내용을 덮어써 고객사도 뒤바뀌었다.

## 변경
- `src/store/report-archive.js`: 임시 파일 이름을 `.${reportId}.${stamp}.tmp`로 바꿨다.
- `test/archive.test.js`: 시계를 멈춰 같은 시각에 4개를 동시에 저장하는 결정적 재현 시험을 추가했다.

## 테스트
- `npm test`: 63 통과. 수정 전 코드에서는 새 시험이 ENOENT로 실패(62 통과, 1 실패).
- `node --test ci/archive.test.js` 15회 모두 통과.
- `npm run test:ci`: archive 시험은 실패 없음. 비목표인 `ci/batch.test.js`의 별개 간헐 실패(pool 결과 순서)로 가끔 전체가 실패한다.
