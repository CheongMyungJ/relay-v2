## 리뷰 지적
1. [권장] src/digest/runner.js:36-41 — 보낸 키는 `markSent` 시점에야 기록되어, 같은 기간의 실행이 겹치면(수동 실행 + 스케줄러 등) 둘 다 `ledger.has`가 false여서 같은 요약을 두 번 보낸다. 보내는 중인 키를 따로 막을 것을 제안.
2. [사소] src/digest/deadline.js:15 — `timeoutMs` 인자와 `digest.sendTimeoutMs` 설정이 효과 없이 남아 있어 오해하기 쉽다. 이미 팀 지식(digest-sendtimeout-unused.md)에 기록되어 있고 제거는 설정 검증·로더까지 건드리므로 범위 밖.

## 반영
- 1 — runner.js에 `inFlight` 키 집합을 두어 보내는 중이거나 보낸 키는 `already`로 센다(`finally`에서 해제). 겹침 실행 테스트 1개 추가. 커밋 0ea7423. `npm test` 79 통과, 0 실패. 재현 절차(테스트 4개)는 그대로이고 달라지지 않았다. 추가 테스트는 runner.js 수정 전 코드에서 실패함을 확인했다.
- 지식 파일 정리(같은 커밋): `docs/knowledge/delivery/digest-sendtimeout-unused.md` 고침, `digest-key-without-runid.md` 새로 만듦.

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 수정 전 src/digest 3개 파일에 새 테스트를 얹어 `npm test`: 5 fail(최초 늦은 성공, 재시도, runId 재실행, 실패 후 재발송, 겹침 실행). 최종 코드: 79 pass, 0 fail |
| `npm test`가 통과한다 | 통과 | 직접 실행: tests 79, pass 79, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f16cc69 -- test`: test/digest.test.js에 65줄 추가, 삭제·수정 0줄 |
| 요약 발송의 각 경로(최초 발송, 재시도, 재실행)마다 같은 기간의 요약이 고객에게 한 번만 전달됨을 보이는 테스트가 있다 | 통과 | test/digest.test.js 끝의 [최초 발송], [재시도], [재실행] 2개, 겹침 실행 테스트. 각각 `mail.sent.length === 1` 확인 |
| 실제로 발송에 실패한 요약은 재발송되고 결국 한 번 전달됨을 보이는 테스트가 있다 | 통과 | [재시도] 테스트(timeout 실패 후 재시도 성공, calls 2, sent 1)와 [재실행] 영구 실패 후 다음 실행에서 재발송(sent 1) |
| 원인이 무엇이고 왜 중복이 생겼는지가 근거와 함께 설명되어 있다 | 통과 | fix.md `## 원인`: 늦은 성공을 시간 초과로 재시도(deadline.js)와 키에 runId 포함(key.js). 수정 전 코드 실행에서 5개 실패로 확인 |

## 테스트 파일 변경
- test/digest.test.js — 약화 아님 — 기존 테스트는 그대로이고 새 테스트 5개만 추가됨(삭제·완화 없음)

## 남은 위험
- 보낸 키 저장소(ledger)가 메모리 TTL 3일이라 프로세스 재시작이나 TTL 만료 뒤 재실행은 막지 못한다. 운영의 공유 DB 전제.
- `digest.sendTimeoutMs`는 효과 없음(지적 2).
- 일반 발송 `src/retry/policy.js`의 `decide`는 건드리지 않음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
