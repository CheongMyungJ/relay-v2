바깥 세계(PTY, 파일, git, HTTP 서버, 프로세스)와 닿는 코드 (I9).
시험은 `test/adapters/`의 [어댑터]이고 Windows 러너에서 돈다.

| 모듈     | 맡는 일                                                                       | 설계                 |
| -------- | ----------------------------------------------------------------------------- | -------------------- |
| `exec`   | 명령 실행, `.cmd`를 `cmd.exe`로 감싸기                                        | I12                  |
| `store`  | RELAY_HOME 경로, 원자적 쓰기, config.json, project.json, Work 디렉터리의 파일 | 5.1~5.5, I11         |
| `git`    | 레포 점검, 기본 브랜치, fetch, worktree, diff, status                         | 시나리오 0·1, I12    |
| `gh`     | `gh auth status`                                                              | D67                  |
| `claude` | 실행 파일 찾기, `--version`, `auth status`, 이번 task의 스킬 배포             | D67, D103, D105~D108 |
| `pty`    | node-pty 세션, DA1 응답, 프로세스 트리 종료, 프로세스 ID와 시작 시각          | S1, I20, I32, D76    |
| `hooks`  | 훅 HTTP 서버, 토큰 확인, Stop 응답                                            | I13, S2, D20, D21    |
| `watch`  | task 디렉터리 감시                                                            | I15                  |
