---
kind: fact
source: investigation
---
# electron-updater의 quitAndInstall은 그 자리에서 설치를 시작하고 곧 앱을 끝낸다

## 내용
- electron-updater 6.8.9의 `quitAndInstall(isSilent, isForceRunAfter)`는 설치를 바로 시작하고, 시작하면 `setImmediate`로 `app.quit()`를 부른다. 세션 정리(`Relay.close`)는 부르기 전에 끝내야 한다(`app/src/main/index.ts`의 `installUpdate`).
- Windows(NsisUpdater)는 설치 파일을 따로 띄운다(`--updated /S --force-run`). 설치 파일은 앱이 남아 있으면 1초 남짓 기다린 뒤 앱의 프로세스를 끝내고, 그래도 남으면 강제로 끝낸다(electron-builder NSIS 템플릿 `_CHECK_APP_RUNNING`).
- Linux .deb(DebUpdater)는 그래픽 비밀번호 도구(pkexec 등)로 `dpkg -i`를 끝날 때까지 동기로 돌린다. 그동안 main 프로세스가 멈춘다.
- 설치를 시작하지 못하면(.deb의 비밀번호 창 취소나 dpkg 실패, 받은 파일 없음) 그 자리에서 `error` 이벤트를 보내고 앱을 끝내지 않는다. 이때 `quitAndInstallCalled`를 되돌리므로 그 뒤 앱을 끝내면 `autoInstallOnAppQuit`이 설치를 한 번 더 시도한다(.deb는 비밀번호를 다시 묻는다).
- `isForceRunAfter`는 `isSilent`가 true일 때만 쓴다(아니면 `autoRunAppAfterInstall`). 둘 다 true면 NSIS와 .deb 모두 설치 뒤 앱을 다시 켠다.

## 바뀐 이력
- 2026-10-07 처음 남김 (Work w-20261006-002)
