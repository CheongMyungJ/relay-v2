# 요약 메일 중복 발송 수정: 성공을 timeout으로 보지 않고, 키에서 runId를 빼고, 고정 Message-ID를 쓴다

## 요약
아침 요약 메일이 같은 날 두 통, 가끔 세 통 나가던 버그를 고친다. 실패한 발송의 재시도는 그대로 둔다.

## 원인
- `withDeadline`이 성공한 발송도 걸린 시간이 sendTimeoutMs를 넘으면 예외를 던져 sent 기록 없이 재시도로 이어졌다.
- 발송 기록 키에 runId가 있어 실행·서버마다 키가 달라 이미 보낸 요약을 알아보지 못했다.
- 메일 서버는 응답이 늦어도 받은 메일을 보내는데, timeout 뒤 재시도가 같은 메일임을 알릴 수단이 없었다.

## 변경
- src/digest/deadline.js: 성공은 시간과 무관하게 성공, `slow` 플래그와 `digest.send.slow` 지표만 남긴다.
- src/digest/key.js: 키를 `digest:기간:사용자`로. 기간+사용자 고정 `digestMessageId` 추가(인코딩이 겹치지 않게 `%`→`=`).
- src/digest/message.js: 요약 메일에 `Message-ID` 헤더 추가.
- src/digest/runner.js: 새 키 사용. 실패 재시도 로직은 변경 없음.
- src/adapters/fake-transports.js: 테스트용 Message-ID 중복 제거와 `delivered: true` 옵션.
- docs/knowledge/: 키 규칙, 재시도 유지와 고정 Message-ID 규칙.
- 범위 밖: 일반 알림 `src/retry/policy.js`는 같은 원인이지만 손대지 않았다.

## 테스트
- `npm test`: 81 통과, 0 실패.
- test/digest-duplicate.test.js 추가(7개). 기준 코드에서 앞의 6개 중 5개 실패, 수정 후 통과. 느린 성공, 이미 나간 뒤 timeout, 실제 실패 재시도, 재실행, 서버 두 대, 키, Message-ID 인코딩.
- 한계: Message-ID 중복 제거는 중계 서버 몫이며 가짜 transport로만 확인했다. 서버 간 동시 발송 선점은 없다.
