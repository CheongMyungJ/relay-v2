## 리뷰 지적
1. [사소] src/digest/key.js:17 — `digestMessageId`가 `%`를 `_`로 바꿔 `a%20b`와 `a_20b` 같은 사용자 ID가 같은 Message-ID가 될 수 있다. 서로 다른 사용자의 요약이 중복 제거로 사라질 수 있으니 `=`로 바꾸자(`encodeURIComponent`가 `=`를 항상 `%3D`로 바꾸므로 겹치지 않는다).
2. [사소] src/adapters/fake-transports.js:8-9 — 새 설명 줄이 결과 목록 주석 중간에 끼어 `푸시만` 줄이 목록에서 떨어져 보인다. 설명을 목록 뒤로 옮기자.

원인과 수정의 대응은 맞다. 성공을 timeout으로 보던 것(deadline.js), 키의 runId(key.js), 재시도 시 같은 메일 식별(Message-ID)을 각각 고쳤고 재시도는 그대로다. 증상만 숨기는 수정은 아니다.

## 반영
- 1 — `digestMessageId`의 인코딩을 `%`→`=`로 바꾸고 회귀 테스트(서로 다른 ID가 다른 Message-ID) 추가. 커밋 fbacadb. `npm test` 81개 통과, 0 실패. 재현 절차는 바뀌지 않았다.
- 팀 지식 2건 추가(docs/knowledge/digest-key-is-period-and-user-only.md, mail-fixed-message-id-and-keep-retry.md), 별도 커밋.

## 반영하지 않은 지적
- 2 (사람이 1번만 고름. 주석 배치라 동작에 영향 없음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (같은 날 요약이 두 통 이상 나가지 않는다) | 통과 | `node --test test/digest-duplicate.test.js`로 4가지 재현(느린 성공, 이미 나간 뒤 timeout, runId 변경 재실행, 서버 두 대) 모두 `mail.sent.length === 1`. 기준 src로 되돌려 같은 테스트를 돌리면 6개 중 5개 실패(재현됨, 검증 단계 추가 전 6개 기준), 현재 코드는 전부 통과 |
| `npm test`가 통과한다 | 통과 | `npm test`: 81 통과, 0 실패 (fix.md의 80에서 테스트 1개 증가) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 830fa47 --name-only`의 테스트 파일은 test/digest-duplicate.test.js(신규)뿐. 기존 테스트 파일 변경 없음 |
| 발송이 실제로 실패한 요약은 여전히 재시도되어 결국 발송되는 것을 테스트가 확인한다 | 통과 | 'timeout로 실제 실패하면 재시도해서 결국 한 통이 나간다': timeout 2번 뒤 호출 3번, sent 1통. 통과 확인 |
| 요약 발송이 성공한 날은 발송 기록(sent)이 남고, 요약이 하루 건너뛰어지지 않는 것을 테스트가 확인한다 | 통과 | '느려도 성공한 발송은…': ledger 상태 `['sent']`, 5000ms 성공이 sent로 기록됨. 재시도 케이스도 `['retry','sent']` |
| 중복 발송을 재현하는 회귀 테스트가 추가된다 | 통과 | test/digest-duplicate.test.js 7개 추가(fix 6개 + 검증 1개), 기준 코드에서 fix의 6개 중 5개 실패 |

## 테스트 파일 변경
- test/digest-duplicate.test.js — 약화 아님 — 신규 파일이며 기존 테스트를 바꾸거나 지우지 않았다. 검증 단계에서 Message-ID 인코딩 테스트 1개만 추가.

## 남은 위험
- Message-ID 중복 제거는 운영 메일 중계 서버가 해 준다고 가정했고 가짜 transport로만 확인했다. 서버가 안 하면 "나갔는데 timeout" 케이스는 중복될 수 있다.
- 서버 두 대 동시 실행은 ledger가 서버별이라 막지 못한다. 공유 DB 선점(claim)이 있어야 완전하다.
- 일반 알림 경로 src/retry/policy.js decide()도 같은 원인이다. 비목표라 고치지 않았다. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기.
- 지적 2(주석 배치)는 남아 있다.
