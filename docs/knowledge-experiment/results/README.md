# 지식 실험의 평가 결과 (요약)

지식 실험(`../protocol.md`)과 그 뒤 후속 개발(`../followup.md`)에서 돌린 평가(E1~E13)의 요약이다. 평가마다 폴더 하나이고, 기록은 `../log.md`에 있다.

- `report.md`: 평가 도구(`app/eval/run.mjs`)가 쓴 실행별·시나리오별 보고서
- `primary-<쪽>-<쪽>.md`: 주지표 비교(`app/eval/primary.mjs`)
- `knowledge-quality.md`: 남은 지식의 질, kind 분포, 지식 검토 호출의 시간·비용(`app/eval/knowledge-quality.mjs`)

실행마다의 원 결과(대화 기록, 스크린샷, diff, run.json, 판정)는 크기(약 1.4GB)가 커서 main에 넣지 않았다. `exp/knowledge-auto` 브랜치의 `app/eval/results/`에 그대로 있다. `../log.md`와 `../followup.md`가 가리키는 `app/eval/results/...` 경로는 그 브랜치의 것이다.

| 폴더 | 평가 |
|---|---|
| e1-baseline | E1 기준(지식 관리 없는 base, A/A) |
| e2-k1 ~ e8-k7 | E2~E8 실험 중 개발(k1~k7) |
| final | E9 마지막 비교(hold-out h1·h2, relay·base·m17) |
| e10-points, e10-k8 | E10 후속 1·2단계(k8) |
| e11-points, e11-k9 | E11 범위 지시·지식 지우기·지식 탭(k9) |
| e12-points, e12-k10 | E12 정하지 않은 것 절과 검토 호출(k10) |
| e13-k11 | E13 문구 고침(k11) |
