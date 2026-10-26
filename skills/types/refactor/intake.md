- Do not plan how to reach the structure. That is the job of refactor.
- Do not write the order or method of the change in the intent. The only exception is the human's suggestions: if the request says how to change it, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". refactor decides whether to take it.
- **Behavior changes and performance goals:** a refactoring does not change behavior. If the request mixes in a behavior change (a feature or a bug fix) or a performance goal (e.g. "두 배 빠르게"), point it out and ask before you write the draft: drop that part to `비목표` and only refactor / change the type (`blocked`). If dropped, write what was dropped in `비목표`.
- **Interfaces used outside the repo** (what a library exports, HTTP API, CLI arguments, stored formats): if the request wants to change one, write what changes in the intent.
- **Vague goals:** if the structural goal is vague ("읽기 쉽게"), ask for a structure that can be checked.
- **완료조건:** always start with these default items.
  `- [ ] 바꾼 곳의 지금 동작을 잡는 안전망 테스트가 있고 기준 코드에서도 통과한다` / `- [ ] 레포 밖 공개 인터페이스가 바뀌지 않는다` (leave out the interfaces the intent says to change)
- Then add the structural conditions that can be checked by reading code or running a command, one per line (e.g. "가격 계산은 `pricing` 모듈 한 곳에만 있다", "`routes/`는 `db/`를 직접 import하지 않는다"). Not the order or method of the change.
