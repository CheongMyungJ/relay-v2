---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(보내기 전 키 선점), 2(느린 실패 재시도 테스트)를 모두 반영"
    why: "사람이 모두 반영을 선택"
    by: human
  - what: "지식 항목 두 개를 같은 경로에 고쳐 씀"
    why: "앞 Work 항목이 기준 브랜치에 없어 같은 경로에 새 형식으로 씀"
    by: ai
  - what: "서버 두 대 원장 비공유 경로를 실패로 판정하고 fix로 돌아간다"
    why: "사람이 fix로 돌아가기를 선택. createNotifier가 인스턴스별 원장을 만들어 주입할 수 없음"
    by: human
assumptions:
  - "운영 중복의 주원인은 느린 메일 성공의 재시도로 보며, 실제 지연 수치는 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "원장을 따로 쓰는 서버 두 대는 중복 발송이 남는다(src/notifier.js:70). 공용 원장이어도 claim의 선점은 프로세스 메모리"
  - "운영 원장이 공용 DB인지, 두 통의 간격(1분, 수십 분)의 출처는 확인하지 못함"
  - "원장이 메모리라 재시작 후 중복 가능"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. deadline.js/key.js, 지식 파일 충돌 가능"
recommended_next:
  node: fix
  reason: "서버 두 대가 원장을 따로 쓰면 이번 수정으로 막히지 않음(todo 테스트 actual 2). 공용 원장 주입과 저장소 쪽 원자적 선점을 고쳐야 함"
knowledge_candidates: []
---
## 요약
리뷰 지적 2건을 모두 반영(커밋 cf70c7f)했고 서버 두 대 테스트 4개를 더했다(커밋 82a5fb5). 원장을 공유하면 한 통이지만 원장을 따로 쓰는 경로는 실패(todo, 실제 2통)라 fix로 돌아가길 추천한다. `npm test` 82개 통과, todo 1.
고친 지식: docs/knowledge/delivery/digest-key-includes-run-id.md — pitfall에서 rule로 바꾸고 runId 제외와 claim/release 규칙을 적음
고친 지식: docs/knowledge/delivery/slow-success-is-not-timeout.md — 느린 실패도 재시도한다는 점과 요약 테스트 위치 추가
## 다음 task가 알아야 할 것
- `src/digest/ledger.js`: `claim`/`release` 추가, `src/digest/runner.js`에서 사용
- 테스트: `test/digest.test.js` 끝 9개(서버 두 대 `twoServers` 도우미 포함), 명령 `npm test`
- 기준 src(`git checkout 4fe181b -- src`)로 돌리면 재현 테스트 4개가 실패한다
