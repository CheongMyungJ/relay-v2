# jobs

고객사 보고서를 밤마다 만드는 배치 작업 실행기다. 작업을 큐에 넣고, 처리기(report, cleanup, notify)로 여러 개를 동시에 돌린 뒤, 결과를 모아 배치 요약을 남긴다. 만든 보고서는 보관소에 파일로 남기고, 정산팀이 가져간다.

## 구조

| 폴더 | 내용 |
|---|---|
| `src/queue/` | 작업 모양과 검사, 우선순위 큐 |
| `src/runner/` | 배치 실행기, 동시 실행(`runPool`), 작업 하나 실행(시간 제한), 재시도 정책 |
| `src/collect/` | 실행 결과를 작업과 짝지은 기록, 배치 요약 |
| `src/handlers/` | 작업 종류별 처리기 |
| `src/sources/` | 메모리 데이터 원천(조회 지연을 흉내 냄) |
| `src/schedule/` | cron 식과 스케줄러 |
| `src/store/` | 키-값 저장소, 배치 기록, 보관소(`file-store.js`)와 보고서 보관(`report-archive.js`) |
| `src/log/`, `src/config.js`, `src/metrics.js`, `src/clock.js` | 로그, 설정(`JOBS_*` 환경 변수), 지표, 시간 |
| `src/nightly.js` | 밤 배치의 작업 목록과 처리기 묶음 |

## 명령

```bash
npm test          # 단위 시험 (test/)
npm run test:ci   # CI가 돌리는 것: 단위 시험 + ci/ (밤 배치를 실제와 비슷한 지연으로 끝까지 돌리고 보관까지 봄)
npm start         # 예시 배치 한 번: node src/cli.js [기간] [고객사 수]
```

외부 의존성은 없다. Node 22 이상.

## 설정

| 환경 변수 | 기본값 | 뜻 |
|---|---|---|
| `JOBS_CONCURRENCY` | 4 | 동시에 돌릴 작업 수 |
| `JOBS_TIMEOUT_MS` | 5000 | 작업 하나의 시간 제한 |
| `JOBS_RETRY_ATTEMPTS` | 3 | 일시 오류일 때 최대 시도 횟수 |
| `JOBS_LOG_LEVEL` | warn | debug, info, warn, error, silent |
