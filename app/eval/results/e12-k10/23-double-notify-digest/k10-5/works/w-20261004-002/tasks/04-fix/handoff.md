---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "공용 원장은 createNotifier의 digestLedger 옵션으로 주입하고, 원자적 선점은 원장의 동기 claim 계약으로 둔다"
    why: "사람 추가 지시. 운영 저장소 구현은 이 저장소에 없어 계약만 문서화"
    by: ai
  - what: "기존 팀 지식 digest-key-includes-run-id.md 규칙을 따라 claim/release 구조 유지"
    why: "docs/knowledge/delivery/digest-key-includes-run-id.md"
    by: ai
assumptions:
  - "운영의 공용 원장(DB)은 claim을 insert-if-absent로 구현한다고 가정. 여기엔 메모리 구현만 있음"
rejected:
  - "일정(scheduler) 중복 실행: lastPeriod로 한 프로세스에서는 막히고 서버 간 문제는 원장 공유로 해결"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 twoServers와 todo 테스트를 바꿨다(기존 테스트 변경). 단언은 유지, 러너 수동 조립을 주입으로 교체. 약화 여부는 verify가 판단"
  - "선점한 서버가 발송 중 죽으면 inFlight 선점이 공용 저장소에 남아 요약이 건너뛰어질 수 있음(선점 만료 없음). 메모리 구현은 프로세스와 함께 사라져 해당 없음"
  - "실제 DB 기반 원장은 구현하지 않음"
recommended_next: null
knowledge_candidates:
  - "서버가 여럿이면 createNotifier({ digestLedger })로 공용 원장을 주입해야 한다. 안 하면 서버마다 한 통씩 나간다. claim은 서버 간 원자적(insert-if-absent)이어야 한다"
  - "정하지 않음: 선점 후 서버가 죽었을 때 선점 만료(lease) — 운영 저장소 구현 시 정해야 함, 지금 메모리 원장은 만료 없음"
---
## 요약
`createNotifier`가 `digestLedger`를 받게 해 서버 여러 대가 원장을 공유할 수 있게 했다. 공용 원장이면 동시·1분·30분 간격 실행 모두 수신자당 한 통이고, 실패한 요약은 선점이 풀려 다른 서버가 다시 보낸다. `npm test` 84개 통과.
## 다음 task가 알아야 할 것
- `src/notifier.js:70`: `o.digestLedger ?? createDigestLedger(...)`
- `src/digest/ledger.js` `claim`: 동기 확인+선점(원자적 계약 주석)
- 테스트: `test/digest.test.js` 서버 두 대 섹션, 커밋 fe6bc83
- 수정 전 4개 실패 확인(notifier.js만 되돌림)
