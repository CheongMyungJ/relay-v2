# relay-v2 확인 기록

구현 마일스톤마다 실제 `claude` 흐름 시험([실제])과 사람의 실기 확인([실기]) 결과를 적는다. 확인할 항목은 `docs/implementation.md` 7절, 확인 방법은 8절을 따른다(I30).

## 기록 규칙

- 확인할 때마다 해당 마일스톤 표에 한 줄씩 더한다.
- 날짜, 앱 커밋, Claude Code 버전, OS를 적는다.
- 러너 결과는 예비 확인이다. OS 칸에 러너 이미지를 적는다(D93).
- [실제]의 메모에는 task마다 형식 오류 되돌림 횟수와 걸린 시간을 적는다(8.4).
- 실패한 항목은 메모에 무엇이 어떻게 달랐는지 적는다.

## M0. 골격과 배포

| 날짜 | 앱 커밋 | Claude Code 버전 | OS | 종류 | 결과 | 메모 |
|---|---|---|---|---|---|---|
| 2026-09-26 | 077c6cf | 해당 없음(가짜 `claude`) | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | [어댑터] | 통과 | app-ci #5. DLL 모드(I32)로 띄운 PTY에서 출력, 한글 인자와 출력, 크기 변경이 맞다. 트리 종료 뒤 자식, 손자 `node.exe`와 `OpenConsole.exe`가 남지 않는다(#2~#5 연속 통과). 가짜 `claude`는 stdin을 raw 모드로 읽어야 Windows에서 크기 변경을 받는다(libuv) |
| 2026-09-26 | 8dbf88c | 해당 없음(가짜 `claude`) | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | [스모크] | 통과 | app-build #1. 러너에서 만든 설치 파일을 `/S`로 설치(`%LOCALAPPDATA%\Programs\relay`)하고 띄운 앱에서 가짜 `claude` 출력이 보이고, 창 크기 변경이 PTY에 전달되고, 탭을 닫으면 프로세스가 끝난다. `npmRebuild: false`로 넣은 node-pty N-API 사전 빌드가 Electron 44에서 로드되고, asar 밖의 `conpty.dll`, `OpenConsole.exe`로 동작한다 |
| 2026-09-26 | - | - | - | [실기] | 생략 | 사용자 결정으로 M0에서는 실기(실제 `claude` 동작, 한글 IME, DLL 모드의 S1 항목)를 하지 않았다. 다음에 실기를 할 때 함께 확인한다 |

## M1. core

[실제]와 [실기] 항목이 없다.

## M2. 최소 흐름

| 날짜 | 앱 커밋 | Claude Code 버전 | OS | 종류 | 결과 | 메모 |
|---|---|---|---|---|---|---|
| 2026-09-26 | 104f86e | 해당 없음(가짜 `claude`) | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | [어댑터] | 통과 | app-ci #8. 등록 점검(D67, D106): 레포 루트, claude 로그인, 실행 파일 없음, 중복은 막고 origin과 gh는 경고만 한다. 기본 브랜치(origin/HEAD, 없으면 현재 브랜치), project-id의 패턴 문자(D111). worktree와 기준 커밋(로컬 기준, fetch한 원격 기준), fetch가 실패하면 Work, worktree, 브랜치를 만들지 않는다. work-id, 훅 서버(I13), 저장소, 스킬 배포(D108), 트리 종료(I32) |
| 2026-09-26 | 104f86e | 해당 없음(가짜 `claude`) | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | [흐름] | 통과 | app-ci #8. M 경로와 S 경로가 [완료만]까지 간다. 되돌린 뒤 고쳐 쓴 handoff로 승인 대기가 되고, 되돌림은 설정 횟수(기본 2, config.json으로 1)까지만 한다. 남은 오류는 [오류 무시하고 승인](D112)으로 넘긴다. D23 멈춤과 알림, D94 경고, handoff 없는 세션 종료. work.json, intent.md, decisions.md, events.jsonl의 모양 |
| 2026-09-26 | f506d2a | 해당 없음(가짜 `claude`) | GitHub Actions windows-latest (win25-vs2026 20260922), 예비 확인 | [스모크] | 통과 | app-build #2. 설치한 앱에서 프로젝트 등록, 새 Work, intake 탭의 PTY 출력과 창 크기 변경, [의도 승인] 뒤 intent.md 확정, intake 세션 트리 종료, 다음 task 시작. 설치본의 resources/skills에서 스킬을 배포했다 |

## M3. 사람 조작과 여러 Work

| 날짜 | 앱 커밋 | Claude Code 버전 | OS | 종류 | 결과 | 메모 |
|---|---|---|---|---|---|---|

## M4. 되감기와 단계 선택

| 날짜 | 앱 커밋 | Claude Code 버전 | OS | 종류 | 결과 | 메모 |
|---|---|---|---|---|---|---|

## M5. 전달과 정리

| 날짜 | 앱 커밋 | Claude Code 버전 | OS | 종류 | 결과 | 메모 |
|---|---|---|---|---|---|---|

## M6. 복구

| 날짜 | 앱 커밋 | Claude Code 버전 | OS | 종류 | 결과 | 메모 |
|---|---|---|---|---|---|---|

## M7. 자동 승인

| 날짜 | 앱 커밋 | Claude Code 버전 | OS | 종류 | 결과 | 메모 |
|---|---|---|---|---|---|---|
