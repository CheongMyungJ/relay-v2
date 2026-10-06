---
kind: pitfall
source: investigation
---
# Relay.close() 뒤에는 앱을 이어 쓸 수 없다

## 내용
- `Relay.close()`(`app/src/main/relay.ts`)는 되돌리는 길이 없다. 대기열을 닫아(`pool.close`) 새 task가 시작되지 않고, Work마다 `shutdown`이 `closing`을 세워 명령이 "앱을 끝내는 중"으로 실패하며, 훅 서버를 닫는다. 창은 그대로라 겉으로는 멀쩡해 보인다.
- 그래서 `Relay.close()` 뒤에 실패할 수 있는 일을 하면 실패해도 앱을 끝내야 한다. 업데이트 버튼의 설치(`app/src/main/index.ts`의 `installUpdate`)는 설치를 시작하지 못하면 까닭을 보이고 끝낸다. Work w-20261006-002의 verify에서 "실패하면 앱을 계속 쓴다"로 짠 것을 고쳤다.

## 바뀐 이력
- 2026-10-07 처음 남김 (Work w-20261006-002)
