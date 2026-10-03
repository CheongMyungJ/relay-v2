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
- 팀원 교대의 머지: 지식 파일(`.relay/knowledge.md`, `docs/knowledge/**`)의 충돌은 양쪽을 합친다(git `merge=union`, 리뷰어가 두 PR의 지식을 모두 살리는 것과 같음). 처음 돌린 판은 충돌 때 뒤 브랜치를 통째로 택해, 머지 전에 갈라진 Work 둘이 같은 파일을 만드는 c1의 앞 Work 지식(노쇼 미래 규칙 포함)이 사라졌다. 되감기로 폐기한 시도의 브랜치(`*-discarded-*`)는 머지하지 않는다. 그 판(`aborted-all4-v1`)은 버리고 처음부터 다시 돌렸다.
- 사람 역할 설명서: 화면 조작만 적는다. c2는 후보3 실험이 M17에 쓴 봉인 안의 설명서(`guides/m17.md`, [지식] 탭과 지식 화면 한 줄)를 그대로 쓴다. c1·c3는 base와 같다.
- hold-out의 `expectedFiles`에 `.relay/**`, `docs/knowledge/**`를 더했다. 지식을 Work 브랜치에 커밋하는 c1·c3만 범위 밖 파일로 세지지 않게 하려는 것이다(c2는 [완료만]이면 브랜치에 지식을 커밋하지 않는다). 숨긴 시험과 다른 내용은 바꾸지 않았다. 풀린 hold-out 시나리오와 열쇠는 커밋하지 않는다.
- 모델: 에이전트 sonnet·medium, 사람 역할 sonnet, 판정 sonnet(하네스 기본값).

## 시나리오

| 시나리오 | 출처 | 보는 것 |
|---|---|---|
| 26-points-policy-change | 새로 만듦 (어느 후보도 개발에 쓰지 않음). 처음 판에서 Work 2의 정책 변경을 "물으면 답함"으로 두었더니 사람 역할이 말하지 않아 지식으로 남을 내용이 없었다. 처음부터 말하는 것(upfront)으로 고쳤다 | Work 1의 적립 규칙이 Work 2에서 바뀐다. 팀원의 Work 3에는 바뀐 규칙이 필요하고, 코드에는 옛 규칙(earn.js)과 새 규칙(tier.js)이 함께 있다. 낡은 지식의 대체, "이번엔 earn.js를 건드리지 않음"이 지속 규칙으로 굳는지 |
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
HOLDOUT_KEY=<열쇠> bash eval/unseal.sh && cp eval/guides/m17.md eval/guides/c2.md
bash <이 폴더>/launch.sh 26,27,h1-parcel-fees,h2-stay-fees 2 all4 3
```

결과는 `results/`와 `report.md`에 둔다.
