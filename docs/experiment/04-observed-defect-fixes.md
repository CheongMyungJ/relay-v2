# 독립 비교 전 관찰 결함 보완

2026-10-03. 근거는 [03-result-and-freeze.md](03-result-and-freeze.md)의 「반증과 수정 선택」과 [seed 문서](results/seed-knowledge.md)다. 공개 개발 실험에서 관찰된 세 결함만 보완했다. 새로운 실제 모델 Work나 독립 평가는 실행하지 않았다. 이전 동결 결과는 당시 구현에 대한 기록이며, 이번 변경의 실제 모델 효과를 설명하지 않는다.

## 변경과 근거

1. clone마다 `w-20261003-001`/`t-01`이 재사용된 문제: 새 task 컨텍스트에 `knowledge_source`를 추가했다. Work 로컬 디렉터리의 `knowledge-source-id`에 임의 UUID를 보존하므로 동일 Work의 task·재시작은 같은 출처를 사용하고, 별도로 생성된 Work는 로컬 번호가 같아도 구별된다. 임시 파일을 쓴 뒤 hard link로 게시해 동시 생성이 기존 ID를 덮어쓰지 않게 했다. 공통 지침은 공유 사실에 이 ID와 답변을 받은 Work/task 번호를 함께 남기도록 한다. ID는 경로·원격 URL·인증 정보에서 만들지 않는다. 공유 지식 자체의 Git blob 출처 표시는 유지한다.
2. seed의 「이번 Work의 구현 수정 범위는 평균뿐」이 장기 규칙과 섞인 문제: 일회성 구현 범위는 intent/task 산출물에만 기록하도록 명시했다. 확인된 센서 관측의 평균·중앙값·최댓값 업무 범위와 `null`/0 규칙은 유지하고 `undefined`/`NaN`은 미확인으로 보존하도록 예시를 적었다. 실제 seed와 후속 산출물은 역사적 근거로 그대로 보존했다.
3. 공통 스킬의 `remove obsolete or irrelevant entries` 문제: 이번 task에 무관하다는 이유로 삭제하지 않도록 교체했다. 대체·사람의 명시적 폐기 근거가 있을 때만 삭제하고 근거를 남긴다. 용량을 맞추려고 확인된 활성 사실을 버리지 않는다. 의미 손실 없이 중복을 줄여도 부족하면 기존 사실을 유지하고 새 사실은 task 산출물에 남겨 용량 충돌을 검토받는다. [지식 운영 절차](knowledge-operation.md)도 같은 원칙으로 갱신했다.

새 DB, UI, 검색 구조, 의존성, work.json 스키마는 추가하지 않았다. 기존 Git diff 검토·공유 절차를 사용한다.

## 필요한 검사

- `cd app && npx vitest run --project adapters test/adapters/knowledge.test.ts --project unit test/unit/context.test.ts --project flow test/flow/codex.test.ts`: 3개 파일, 64개 검사 통과. UUID의 재사용·서로 다른 로컬 Work 구분·동시 생성·임시 파일 정리·잘못된 ID 거부, 컨텍스트 전달, 기존 Git 공유·수정·삭제·크기 제한 및 가짜 CLI 흐름을 확인했다. Work 구분 검사는 분리된 로컬 디렉터리로 수행했으며 실제 모델의 문서 작성 검사가 아니다.
- `cd app && npm run typecheck`: 통과.
- 변경한 TypeScript 5개 파일 대상 ESLint와 Prettier: 통과. 최초 lint에서 테스트의 non-null assertion 6곳이 지적되어 수정한 뒤 재검사했다.
- `node skills/check.mjs`: 크기·템플릿·유형별 조립을 포함해 모두 통과.
- `git diff --check`: 통과. 전체 테스트나 실제 모델 Work는 이번 범위에 불필요하여 실행하지 않았다.

## 한계와 실행 조건

UUID는 출처를 구별하는 표시이며 사람 신원이나 답변의 진위를 인증하지 않는다. 기존 Work에 파일이 없으면 다음 컨텍스트 생성 때 ID가 생기지만 과거 공유 사실의 누락된 출처를 소급해서 지어내지 않는다. RELAY_HOME의 Work 디렉터리 자체를 복사하면 같은 출처가 복사된다. UUID 파일을 삭제하면 출처 연속성이 끊어지고, 잘못된 내용이나 파일 생성 실패는 task 시작 오류로 드러난다. hard link를 지원하는 로컬 파일시스템이 필요하며 이번 검사는 Linux 환경에서만 했다.

범위 분리와 활성 지식 보존은 지침 보완이다. 모델이 항상 준수하거나 요약 손실을 방지한다고 입증하지 않았다. 다수 팀원 공유·과대 문서의 실제 운영·사람 검토 부담도 이번에 검증하지 않았다. **시간·비용 개선이 검증됐다고 기록하지 않는다.** 이후 상위 진행자가 새 평가 자료와 실제 Codex 비교로 판단해야 한다.

이번 실행은 10분 이내에 마무리했다. 추가 모델 호출은 0회이며 codex-pinned를 통한 새 실제 Work도 실행하지 않았다. quota.py로 확인한 시작·마무리 잔여량은 모두 89%로 33% 중단 기준에 도달하지 않았다. quota.py/quota-watch.py/manifest 예산/QUOTA_STOP은 변경하지 않았다. 기존 대조군과 독립 평가 자료는 읽지 않았으며 원격 게시와 main 수정 없이 후보 실험 브랜치에서 로컬 커밋했다.
