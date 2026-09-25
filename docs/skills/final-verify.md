# `final-verify` — 최종 검증

## 목적

intent의 **완료조건 하나하나**에 대해 통과/실패를 증거와 함께 판정한다. 테스트가 약해지지 않았는지 diff를 점검한다. delivery가 `pr`이면 PR 제목과 본문 초안을 쓴다.

이 스킬은 fix를 한 세션과 **다른 새 세션**에서 실행된다. 작성자와 검토자를 분리하는 효과를 노린 것이다.

## 입력 (context.md)

intent(완료조건이 채점 기준), decisions, rejected-log, handoff-chain(모든 이전 단계 요약), git-diff 조각(`base_commit..HEAD`의 파일 목록, 줄 수, 테스트 파일 변경 목록 — 앱이 계산), 최근 check 결과 조각(g-tests 결과), `evidence/evidence.md?`, `rca/rca.md?`, `fix/fix.md`(path), gate-policy, next-options.

## 결정 지점 (질문 예산: 최대 1개)

| # | 결정 | `requires_human` | 언제 |
|---|---|---|---|
| 1 | 판정이 애매한 완료조건을 어떻게 볼 것인가 | ✅ | 자동으로 확인할 수 없는 완료조건이 있을 때만 |

최종 승인은 버튼으로 한다. 이 스킬이 "승인해도 될까요?"를 묻지 않는다.

## 절차

1. 완료조건을 목록으로 뽑는다. 항목마다 확인 방법을 정한다: 앱이 이미 확인한 검사 결과 인용 / 직접 명령 실행 / 코드 읽기 / 사람 확인 필요.
2. 각 항목을 확인하고 증거(명령과 출력, 파일:줄, 검사 로그 경로)를 적는다.
3. **테스트 약화 점검(필수):** git-diff 조각의 테스트 파일 변경을 모두 읽는다. 단언 삭제, skip/only, 기대값 변경, 타임아웃 증가, 재현 테스트 변경이 있으면 "실패"나 "주의"로 판정한다.
4. 범위 점검: diff에 비목표에 해당하는 변경이 있으면 `intent_deviation`에 적는다.
5. 판정:
   - 모두 통과 → `recommended_next: null` (기본: g-done)
   - 수정 필요 → `recommended_next: { node: fix, reason }`
   - 원인이 틀렸음 → `recommended_next: { node: rca, reason }`
6. intent.delivery가 `pr`이면 `pr.md`(PR 본문)를 쓰고 `delivery_draft`를 채운다.
7. `_close`.

## 완료조건

- 모든 완료조건에 판정(통과/실패/사람 확인 필요)과 증거가 있다.
- 테스트 약화 점검 절이 있고, 테스트 파일 변경이 하나도 빠짐없이 언급되어 있다.
- delivery가 pr이면 `pr.md`와 `delivery_draft`가 있다.

## 산출물 템플릿 — `verification.md`

```markdown
# 최종 검증: <intent 제목> (intent v<N>)

## 완료조건별 판정
| # | 완료조건 | 판정 | 증거 |
|---|---|---|---|
| 1 | 고정된 재현 테스트가 통과한다 | 통과 | g-tests check 로그 `tasks/06-g-tests/checks/repro-passes.log` |

## 테스트 약화 점검
| 파일 | 변경 종류 | 판단 |
|---|---|---|
(변경 없으면 "테스트 파일 변경 없음 (git-diff 조각 기준)")

## 범위 점검
- 비목표 위반: 없음 | ...

## 결론
통과 | 수정 필요(→ fix) | 원인 재검토(→ rca)
```

## 산출물 템플릿 — `pr.md` (delivery: pr일 때)

```markdown
## 문제
## 원인
## 변경
## 검증
- 완료조건별 결과 요약 (verification.md 표를 줄여서)
## 참고
- relay work: <work-id>
```

## handoff 확장

```yaml
artifacts: [verification.md, pr.md]
delivery_draft: { pr_title: "fix(auth): compare token expiry in UTC epoch", pr_body: pr.md }
```

## 하지 말 것

- 코드를 고치지 않는다. 고칠 점은 fix로 돌려보낸다(검증자와 작성자 분리).
- 에이전트가 직접 돌린 검사만으로 "통과"라 쓰지 않는다. 앱의 검사 결과가 있으면 그것을 인용한다.

## relay.json

```json
{ "schema_version": 1, "name": "final-verify", "title": "최종 검증",
  "summary": "완료조건별 판정과 테스트 약화 점검",
  "produces": [
    { "path": "verification.md", "required": true,
      "required_headings": ["완료조건별 판정", "테스트 약화 점검", "결론"] },
    { "path": "pr.md", "required": true, "when": "intent.delivery == 'pr'" } ],
  "handoff_extensions": [], "writes_code": false }
```

`delivery_draft`는 delivery가 pr일 때만 필수라 `handoff_extensions`에 넣지 않고, 앱이 `pr.md`의 `when`과 같은 조건으로 따로 검사한다.
