# 공개 개발 실험 재현

이 문서는 공개 dev 사례만 사용한다. 독립 최종 평가의 정답을 생성하거나 읽지 않는다. 실제 Work는 동시에 하나, 실행은 90분 이하이며 각 Work 상한은 harness manifest 값이다. 시작 전과 Work 사이에 quota.py로 잔여량을 확인한다. 33% 이하/QUOTA_STOP이면 새 모델을 실행하지 않는다. 50%에서는 최종 평가 예산을 재검토한다. pinned wrapper와 watcher, manifest는 수정하지 않는다.

저장소 검사는 다음과 같다. 이는 가짜 Codex를 사용하는 흐름 테스트를 포함하고 실제 모델 효과 점수가 아니다.

```sh
npm run typecheck --prefix app
npm run lint --prefix app
npm run format:check --prefix app
npm test --prefix app
npm run check --prefix skills
```

새 경로를 정해 최초 fixture와 실제 세션을 시작한다. 아래 명령은 터미널에서 stdin을 열린 상태로 실행한다. 상위 자동 도구에서는 tty=true를 사용한다.

```sh
python /workspace/relay-experiment/scripts/quota.py
python /workspace/relay-experiment/scripts/prepare-fixture.py /tmp/relay-knowledge-dev/fixture
node /workspace/relay-experiment/scripts/relay-session.mjs /workspace/relay-candidate /tmp/relay-knowledge-dev/work1 /tmp/relay-knowledge-dev/fixture real
```

harness stdin으로 JSON-lines 명령을 입력한다. 요청은 `/workspace/relay-experiment/evaluation/dev/scenario.json`의 works[0].request와 동일하게 사용한다. `create`가 준 workKey와 snapshot의 task ID를 이후 명령에 넣는다.

```json
{"id":1,"op":"create","request":"센서 관측 보고서에서 표본이 없거나 일부 관측이 빠진 날의 평균 표시가 업무팀 기대와 다르다. src/average.js를 조사하고 수정해줘. 실제 값 0과 음수는 정상 관측이다. 다른 집계 함수는 이번 범위 밖이다."}
{"id":2,"op":"snapshot"}
```

snapshot에서 폴더 신뢰 확인이 나오면 이 실험용 파일을 검토하고 terminal 명령으로 Enter(`"text":"\r"`)를 보낸다. /hooks 검토가 필요하면 실제 화면에 따라 검토한다. MCP 질문이 오면 관련 질문에만 scenario.on_ask의 사실을 답한다. undefined/NaN 등의 시나리오 밖 사실은 모른다고 답한다. 추천 선택지를 자동 승인하지 않는다.

```json
{"id":3,"op":"terminal","terminal":"<workKey>/t-01","text":"\r"}
{"id":4,"op":"answer","work":"<workKey>","task":"t-01","question":"<snapshot question id>","answers":{"<question field id>":["<관련 확인된 사실>"]}}
{"id":5,"op":"review","work":"<workKey>","task":"t-01"}
{"id":6,"op":"approve","work":"<workKey>","task":"t-01"}
```

각 단계가 awaiting_approval이 되면 review의 gate/errors, 산출물과 diff를 실제로 읽는다. 올바르면 approve, 아니라면 terminal로 수정 지시한다. force는 금지한다. verify는 완료만으로 승인한다. completed를 확인하고 close하며 프로세스 종료를 기다린다. 원본 Work를 수정하지 않고 별도 복사본에서 check-dev-fixture.mjs를 실행한다.

공유 절차는 승인한 평균 Work를 실험 fixture의 main에 fast-forward한 후 로컬 bare 원격에 push하고 clone하는 것이다. candidate 구현 저장소 main은 변경하지 않는다. Work 상태나 RELAY_HOME은 복사하지 않는다. 예를 들면:

```sh
git init --bare -b main /tmp/relay-knowledge-dev/team.git
git -C /tmp/relay-knowledge-dev/fixture merge --ff-only relay/w-20261003-001
git -C /tmp/relay-knowledge-dev/fixture remote add origin /tmp/relay-knowledge-dev/team.git
git -C /tmp/relay-knowledge-dev/fixture push origin main
git clone /tmp/relay-knowledge-dev/team.git /tmp/relay-knowledge-dev/with
git clone /tmp/relay-knowledge-dev/team.git /tmp/relay-knowledge-dev/without
```

clone마다 Git author를 설정한다. without에서 `.relay/knowledge.md`만 git rm하고 커밋한다. 두 clone의 `git rev-parse HEAD:src`와 `HEAD:test`가 각각 동일한지 확인한다. 다른 clone에 없는 커밋 ID로 git diff하지 않는다.

with를 대상으로 relay-session.mjs를 새 run 디렉터리(work2-shared)로 실행해 scenario.works[1].request를 수행하고 종료한다. 그다음 without에서 새 run 디렉터리(work2-no-knowledge)로 같은 요청을 실행한다. 순서 효과가 있으므로 이번 한 번의 비교는 탐색 자료다. 새 세션/새 RELAY_HOME 조건은 harness가 제공하며 모델은 CODEX_BIN의 scripts/codex-pinned로 고정된다.

각 완료 후 사용량과 운영 지표를 추출한다. 같은 세션의 누적 token_count를 반복 합산하지 않는다.

```sh
python /workspace/relay-experiment/scripts/collect-codex-usage.py /tmp/relay-knowledge-dev/work1
python docs/experiment/measure.py /tmp/relay-knowledge-dev/work1
node /workspace/relay-experiment/scripts/check-dev-fixture.mjs /tmp/relay-knowledge-dev/check-work1 average
```

후속 run도 동일하게 수집하고, 각 최종 worktree를 새 복사본으로 만들어 median oracle과 npm test를 실행한다. 모델/하네스 실패를 정답으로 세지 않는다. 문서 존재 → Git 공유 → 앱 context 노출 → 모델 인용/사용 → 정답·비용을 각각 확인한다. GUI 사용성과 사람이 느끼는 관리 부담은 별도 사람 시험이 필요하다.
