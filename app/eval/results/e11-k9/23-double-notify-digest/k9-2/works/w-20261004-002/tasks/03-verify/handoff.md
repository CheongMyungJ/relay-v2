---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(busy 따로 세기)을 반영하고 지적 2는 철회"
    why: "사람이 모두 반영을 골랐다. 지적 2는 가드를 빼 보니 테스트 17이 실패해 잘못된 지적이었다"
    by: human
  - what: "서버 두 대 중복을 ledger 원자적 예약(claim)으로 막는다. 실패한 발송은 예약을 풀어 재시도"
    why: "사람이 서버 두 대에서 실제로 돈다고 알려 주고 B(claim 추가와 두 인스턴스 테스트)를 골랐다. 재시도는 그대로"
    by: human
assumptions:
  - "ledger는 서버 간 공유 DB라고 가정(주석 기준). 여기서는 메모리"
rejected:
  - "지적 2(테스트 17이 running 가드를 못 거른다): 가드를 빼면 17번이 실패하므로 철회"
open_questions: []
intent_deviation: null
risks:
  - "어댑터가 ETIMEDOUT/ECONNRESET을 던졌는데 서버는 이미 보낸 경우는 알 수 없어 재시도되며 중복 가능(멱등 키 필요)"
  - "기본 ledger는 메모리라 운영에서는 공유 ledger를 digestLedger로 넣고 claim을 insert-if-absent로 구현해야 함. 실제 DB 원자성은 미확인(테스트는 같은 객체 공유)"
  - "서버가 예약한 채 죽으면 claimTtlMs(10분) 동안 그 요약은 다른 서버가 안 보냄. busy로 건너뛴 사용자는 상대 발송이 실패하면 수동 run 필요"
  - "재시도를 소진해 failed된 기간은 일정이 다시 시도하지 않음(수동 run으로 재발송)"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: deadline/시간 초과 처리. 머지 시 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경을 리뷰해 사소한 지적 1건(겹친 실행으로 건너뛴 건을 `busy`로 따로 셈)을 반영했고, 다른 1건은 잘못된 지적이라 철회했다. 사람 질문으로 서버 두 대 중복 경로를 알게 되어 ledger에 원자적 예약(claim)을 넣고 서버 두 대 테스트 3개를 추가했다. 완료조건 6개 모두 통과했다(서버 두 대는 같은 ledger 객체를 공유하는 두 notifier로만 확인). 기준 코드에서 새 테스트 6개가 실패함을 다시 확인했고, 최종 코드에서 `npm test`는 85/85 통과다. 테스트는 추가만 했고 약화는 없다.
새 지식: docs/knowledge/digest/digest-key-and-schedule.md — 요약 키·일정·예약(claim)·공유 ledger에 대한 기존 항목이 없다
고친 지식: docs/knowledge/retry/success-is-success-regardless-of-time.md — 요약 키 runId 서술이 낡아 digest 항목 참고로 옮기고 slow 표시를 적었다
고친 지식: docs/knowledge/retry/keep-retry-for-real-failures.md — 내용은 그대로이고, 기준 브랜치에 없던 앞 Work의 파일을 이 브랜치에 같은 경로로 옮겨 적었다
## 다음 task가 알아야 할 것
- 커밋: 10135c2(busy 집계), ef957cc(지식 문서), d58910a(claim), e037c06(지식 갱신).
- `src/digest/ledger.js` claim/release, `src/digest/runner.js:40-50` 예약, `src/notifier.js` digestLedger 옵션.
- 서버 두 대 테스트: `test/digest.test.js` 18~20번.
- 검증 명령: `npm test`, `node --test test/digest.test.js`.
- `pr.md`와 `verification.md`는 task 디렉터리에 있다.
