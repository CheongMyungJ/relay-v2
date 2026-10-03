# 지식 관리 세 후보 비교

세 후보 브랜치의 지식 관리를 같은 시나리오, 같은 모델, 같은 사람 역할로 돌려 견준다.

| 쪽 | 빌드 | 방식 |
|---|---|---|
| base | `0247049` | 지식 관리 없음 (기준) |
| c1 | `experiment/knowledge-autonomy-evaluated` (`8155a66`, 앱·스킬은 `068cc27`과 같음) | `.relay/knowledge.md` 하나를 코드와 함께 커밋, 통째로 주입 |
| c2 | `ccr-26ecb453-qntcb2` (`a86c61b`) | M17 구조화 지식 + K1~K33 개선 |
| c3 | `exp/knowledge-auto` (`914234e`, 앱·스킬은 `d47836a`와 같음) | `docs/knowledge/<이름>.md`, verify가 정리해 커밋 |

## 방법

- 평가 도구: 후보3 브랜치(`exp/knowledge-auto`)의 하네스. 빌드마다 쪽을 두고(`--app`), 팀원 교대는 앞 사람의 브랜치를 main에 머지한 뒤 새 clone과 새 앱 저장소에서 시작한다(다른 사람의 컴퓨터). 이 폴더의 `harness.patch`를 그 브랜치에 적용하면 아래가 더해진다.
- 보정 하나: M17 계열(c2)은 [완료만]으로 끝낸 Work의 팀 지식을 앱 저장소의 공유 대기에 두고 다음 [PR 생성]에 싣는다(D308). 다른 쪽은 Work 브랜치에 지식을 커밋하므로 브랜치 머지로 건너간다. 팀원 교대를 "PR 머지"로 모사하는 이 도구에서 같은 조건을 주려고, 교대 때 앞 사람의 공유 대기를 지식 폴더에 커밋해 함께 머지한다(`lib/repo.mjs`의 `sharePending`). 공유 대기가 없는 쪽에는 아무 일도 하지 않는다.
- 사람 역할 설명서: 화면 조작만 적는다. c2는 Work 완료 화면의 [지식] 탭과 지식 화면을 덧붙였다(`guides/c2.md`). c1·c3는 base와 같다.
- 모델: 에이전트 sonnet·medium, 사람 역할 sonnet, 판정 sonnet(하네스 기본값).

## 시나리오

| 시나리오 | 출처 | 보는 것 |
|---|---|---|
| 26-points-policy-change | 새로 만듦 (어느 후보도 개발에 쓰지 않음) | Work 1의 적립 규칙이 Work 2에서 바뀐다. 팀원의 Work 3에는 바뀐 규칙이 필요하고, 코드에는 옛 규칙(earn.js)과 새 규칙(tier.js)이 함께 있다. 낡은 지식의 대체, "이번엔 earn.js를 건드리지 않음"이 지속 규칙으로 굳는지 |
| 27-noshow-future-rule | 새로 만듦 | Work 1에서 사람이 아직 만들지 않은 노쇼 수수료 규칙을 미리 말한다. 팀원의 Work 3이 그 기능을 만든다. 레포에는 구 시스템 위약금(20%) 함수가 있다. 미래 규칙의 전달, 코드 모양 함정 |
| h1, h2 (hold-out) | 후보3의 봉인 hold-out | 후보1·2는 본 적 없음, 후보3은 결과를 보고 고치지 않음 |

두 새 시나리오는 `check-scenario.mjs`로 확인했다: 기준에서 숨긴 시험이 실패하고, Work마다의 정답은 그 Work의 시험만 통과하고, 정답을 차례로 모두 적용하면 모두 통과하고, 함정 패치(각 6개)는 모두 걸린다.

## 돌리기

```bash
git worktree add ../kc-harness origin/exp/knowledge-auto
cd ../kc-harness && git apply <이 폴더>/harness.patch
cd app && bash eval/setup.sh
for spec in base:0247049 c1:origin/experiment/knowledge-autonomy-evaluated c2:origin/ccr-26ecb453-qntcb2 c3:origin/exp/knowledge-auto; do
  bash eval/ref-app.sh ${spec%%:*} $(git rev-parse ${spec#*:}) /home/user/kc-ref
done
bash <이 폴더>/launch.sh 26,27 2 new-26-27 3
```

결과는 `results/`와 `report.md`에 둔다.
